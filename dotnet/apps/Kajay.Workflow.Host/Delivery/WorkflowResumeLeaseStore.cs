using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class WorkflowResumeLeaseStore(
    WorkflowDbContext database,
    TimeProvider timeProvider,
    IOptions<WorkflowWorkerOptions> options)
{
    internal async Task<IReadOnlyList<WorkflowResumeLease>> ClaimAsync(
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        await using var transaction = await database.Database.BeginTransactionAsync(
            cancellationToken).ConfigureAwait(false);
        WorkflowResumeRecord[] records = await database.WorkflowResumes
            .FromSqlInterpolated($$"""
                SELECT * FROM workflow_resumes
                WHERE ("Status" = 'pending' OR ("Status" = 'leased' AND "LeaseUntil" <= {{now}}))
                  AND "AvailableAt" <= {{now}}
                ORDER BY "AvailableAt", "Id"
                FOR UPDATE SKIP LOCKED
                LIMIT {{options.Value.BatchSize}}
                """)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        Lease(records, now);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return records.Select(WorkflowResumeLease.From).ToArray();
    }

    internal async Task<WorkflowResumeLease?> ClaimAsync(
        Guid recordId,
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        await using var transaction = await database.Database.BeginTransactionAsync(
            cancellationToken).ConfigureAwait(false);
        WorkflowResumeRecord? record = await database.WorkflowResumes
            .FromSqlInterpolated($$"""
                SELECT * FROM workflow_resumes
                WHERE "Id" = {{recordId}}
                  AND ("Status" = 'pending' OR ("Status" = 'leased' AND "LeaseUntil" <= {{now}}))
                  AND "AvailableAt" <= {{now}}
                FOR UPDATE SKIP LOCKED
                """)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (record is not null)
        {
            Lease([record], now);
            await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return record is null ? null : WorkflowResumeLease.From(record);
    }

    internal async Task CompleteAsync(
        WorkflowResumeLease lease,
        CancellationToken cancellationToken)
    {
        WorkflowResumeRecord? record = await FindCurrentAsync(lease, cancellationToken)
            .ConfigureAwait(false);
        if (record is null)
        {
            return;
        }
        record.Status = "completed";
        record.CompletedAt = timeProvider.GetUtcNow();
        record.LeaseToken = null;
        record.LeaseUntil = null;
        record.LastError = null;
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task FailAsync(
        WorkflowResumeLease lease,
        Exception exception,
        CancellationToken cancellationToken)
    {
        WorkflowResumeRecord? record = await FindCurrentAsync(lease, cancellationToken)
            .ConfigureAwait(false);
        if (record is null)
        {
            return;
        }
        record.Status = record.Attempts >= options.Value.MaximumAttempts
            ? "dead-letter"
            : "pending";
        record.AvailableAt = timeProvider.GetUtcNow() + RetryDelay(record.Attempts);
        record.LeaseToken = null;
        record.LeaseUntil = null;
        record.LastError = Truncate(exception.Message);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private void Lease(IEnumerable<WorkflowResumeRecord> records, DateTimeOffset now)
    {
        DateTimeOffset leaseUntil = now + options.Value.LeaseDuration;
        foreach (WorkflowResumeRecord record in records)
        {
            record.Status = "leased";
            record.LeaseToken = Guid.CreateVersion7();
            record.LeaseUntil = leaseUntil;
            record.Attempts += 1;
        }
    }

    private Task<WorkflowResumeRecord?> FindCurrentAsync(
        WorkflowResumeLease lease,
        CancellationToken cancellationToken)
    {
        return database.WorkflowResumes.SingleOrDefaultAsync(
            item => item.Id == lease.RecordId
                && item.LeaseToken == lease.LeaseToken
                && item.Status == "leased",
            cancellationToken);
    }

    private static TimeSpan RetryDelay(int attempt) =>
        TimeSpan.FromSeconds(Math.Min(300, Math.Pow(2, attempt)));

    private static string Truncate(string value) =>
        value.Length <= 2048 ? value : value[..2048];
}
