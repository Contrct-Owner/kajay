using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class ScheduledActionLeaseStore(
    WorkflowDbContext database,
    TimeProvider timeProvider,
    IOptions<WorkflowWorkerOptions> options)
{
    internal async Task<IReadOnlyList<ScheduledActionLease>> ClaimAsync(
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        DateTimeOffset leaseUntil = now + options.Value.LeaseDuration;
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);
        ScheduledActionRecord[] records = await database.ScheduledActions
            .FromSqlInterpolated($$"""
                SELECT * FROM scheduled_actions
                WHERE ("Status" = 'pending' OR ("Status" = 'leased' AND "LeaseUntil" <= {{now}}))
                  AND "DueAt" <= {{now}}
                ORDER BY "DueAt", "Id"
                FOR UPDATE SKIP LOCKED
                LIMIT {{options.Value.BatchSize}}
                """)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        foreach (ScheduledActionRecord record in records)
        {
            record.Status = "leased";
            record.LeaseToken = Guid.CreateVersion7();
            record.LeaseUntil = leaseUntil;
            record.Attempts += 1;
        }
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return records.Select(ScheduledActionLease.From).ToArray();
    }

    internal async Task FailAsync(
        ScheduledActionLease lease,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ScheduledActionRecord? record = await database.ScheduledActions.SingleOrDefaultAsync(
            item => item.Id == lease.ActionRecordId
                && item.LeaseToken == lease.LeaseToken
                && item.Status == "leased",
            cancellationToken).ConfigureAwait(false);
        if (record is null)
        {
            return;
        }
        record.LastError = exception.Message.Length <= 2048
            ? exception.Message
            : exception.Message[..2048];
        record.LeaseToken = null;
        record.LeaseUntil = null;
        if (record.Attempts >= options.Value.MaximumAttempts)
        {
            record.Status = "dead-letter";
        }
        else
        {
            record.Status = "pending";
            record.DueAt = timeProvider.GetUtcNow() + TimeSpan.FromSeconds(
                Math.Min(300, Math.Pow(2, record.Attempts)));
        }
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
