using System.Text.Json;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class IdempotencyCoordinator(WorkflowDbContext database, TimeProvider timeProvider)
{
    internal async Task<IDbContextTransaction> BeginAsync(
        string tenantId,
        string key,
        CancellationToken cancellationToken)
    {
        IDbContextTransaction transaction = await database.Database
            .BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _ = await database.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({tenantId + ':' + key}, 0))",
                cancellationToken).ConfigureAwait(false);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    internal async Task<T?> FindAsync<T>(
        string tenantId,
        string key,
        string operation,
        string requestHash,
        CancellationToken cancellationToken)
        where T : class
    {
        IdempotencyRecord? existing = await database.IdempotencyRecords
            .AsNoTracking()
            .SingleOrDefaultAsync(
                record => record.TenantId == tenantId && record.Key == key,
                cancellationToken).ConfigureAwait(false);
        if (existing is null)
        {
            return null;
        }
        if (!string.Equals(existing.Operation, operation, StringComparison.Ordinal)
            || !string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
        {
            throw new WorkflowProblemException(
                StatusCodes.Status409Conflict,
                "idempotency-key-reused",
                "The idempotency key was already used for a different request.");
        }
        return JsonSerializer.Deserialize<T>(existing.ResultJson, WorkflowJson.Options)
            ?? throw new InvalidDataException("A stored idempotency result is invalid.");
    }

    internal void Add<T>(
        string tenantId,
        string key,
        string operation,
        string requestHash,
        T result)
    {
        database.IdempotencyRecords.Add(new IdempotencyRecord
        {
            TenantId = tenantId,
            Key = key,
            Operation = operation,
            RequestHash = requestHash,
            ResultJson = JsonSerializer.Serialize(result, WorkflowJson.Options),
            CreatedAt = timeProvider.GetUtcNow(),
        });
    }

    internal Task UpdateResultAsync<T>(
        string tenantId,
        string key,
        T result,
        CancellationToken cancellationToken)
    {
        string json = JsonSerializer.Serialize(result, WorkflowJson.Options);
        return database.IdempotencyRecords
            .Where(record => record.TenantId == tenantId && record.Key == key)
            .ExecuteUpdateAsync(
                update => update.SetProperty(record => record.ResultJson, json),
                cancellationToken);
    }
}
