using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class OutboxLeaseStore(
    WorkflowDbContext database,
    TimeProvider timeProvider,
    IOptions<WorkflowWorkerOptions> options)
{
    internal async Task<IReadOnlyList<OutboxLease>> ClaimAsync(
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        DateTimeOffset leaseUntil = now + options.Value.LeaseDuration;
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);
        OutboxMessageRecord[] records = await database.OutboxMessages
            .FromSqlInterpolated($$"""
                SELECT * FROM outbox_messages
                WHERE ("Status" = 'pending' OR ("Status" = 'leased' AND "LeaseUntil" <= {{now}}))
                  AND "AvailableAt" <= {{now}}
                ORDER BY "AvailableAt", "Id"
                FOR UPDATE SKIP LOCKED
                LIMIT {{options.Value.BatchSize}}
                """)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        foreach (OutboxMessageRecord record in records)
        {
            record.Status = "leased";
            record.LeaseToken = Guid.CreateVersion7();
            record.LeaseUntil = leaseUntil;
            record.Attempts += 1;
        }
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return records.Select(OutboxLease.From).ToArray();
    }

    internal async Task FailAsync(
        OutboxLease lease,
        Exception exception,
        CancellationToken cancellationToken)
    {
        OutboxMessageRecord? record = await database.OutboxMessages.SingleOrDefaultAsync(
            item => item.Id == lease.MessageId
                && item.LeaseToken == lease.LeaseToken
                && item.Status == "leased",
            cancellationToken).ConfigureAwait(false);
        if (record is null)
        {
            return;
        }
        record.LastError = Truncate(exception.Message);
        record.LeaseToken = null;
        record.LeaseUntil = null;
        if (record.Attempts >= options.Value.MaximumAttempts)
        {
            record.Status = "dead-letter";
        }
        else
        {
            record.Status = "pending";
            record.AvailableAt = timeProvider.GetUtcNow() + RetryDelay(record.Attempts);
        }
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private static TimeSpan RetryDelay(int attempt)
    {
        return TimeSpan.FromSeconds(Math.Min(300, Math.Pow(2, attempt)));
    }

    private static string Truncate(string value)
    {
        return value.Length <= 2048 ? value : value[..2048];
    }
}
