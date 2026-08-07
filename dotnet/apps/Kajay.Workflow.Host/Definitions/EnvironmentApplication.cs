using System.Text.Json;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class EnvironmentApplication(
    WorkflowDbContext database,
    TimeProvider timeProvider)
{
    private readonly WorkflowDbContext _database = database;
    private readonly TimeProvider _timeProvider = timeProvider;

    internal async Task<EnvironmentResult[]> ListAsync(
        string tenantId,
        CancellationToken cancellationToken) =>
        await _database.Environments.AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .OrderBy(item => item.Position)
            .ThenBy(item => item.Name)
            .Select(item => new EnvironmentResult(
                item.Name,
                item.DisplayName,
                item.RequiresApproval,
                item.Position,
                item.Version,
                item.CreatedBy,
                item.CreatedAt,
                item.UpdatedBy,
                item.UpdatedAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);

    internal async Task<EnvironmentResult> CreateAsync(
        string tenantId,
        string actorId,
        CreateEnvironmentRequest request,
        CancellationToken cancellationToken)
    {
        string name = ValidateEnvironmentName(request.Name);
        string displayName = ValidateDisplayName(request.DisplayName);
        ValidatePosition(request.Position);
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"environment:{tenantId}:{name}", cancellationToken).ConfigureAwait(false);
        bool exists = await _database.Environments.AnyAsync(
            item => item.TenantId == tenantId && item.Name == name,
            cancellationToken).ConfigureAwait(false);
        if (exists)
        {
            throw Problem(StatusCodes.Status409Conflict, "environment-already-exists",
                $"Environment '{name}' already exists.");
        }
        DateTimeOffset now = _timeProvider.GetUtcNow();
        EnvironmentRecord environment = NewEnvironment(
            tenantId, actorId, name, displayName, request.RequiresApproval,
            request.Position, now);
        _database.Environments.Add(environment);
        AppendEnvironmentAudit(environment, actorId, "environment-created", now);
        await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToResult(environment);
    }

    internal async Task<EnvironmentResult> UpdateAsync(
        string tenantId,
        string actorId,
        string environmentName,
        long expectedVersion,
        UpdateEnvironmentRequest request,
        CancellationToken cancellationToken)
    {
        string name = ValidateEnvironmentName(environmentName);
        string displayName = ValidateDisplayName(request.DisplayName);
        ValidatePosition(request.Position);
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"environment:{tenantId}:{name}", cancellationToken).ConfigureAwait(false);
        EnvironmentRecord environment = await GetRequiredAsync(
            tenantId, name, cancellationToken).ConfigureAwait(false);
        RequireVersion(expectedVersion, environment.Version, "environment-version-conflict");
        DateTimeOffset now = _timeProvider.GetUtcNow();
        environment.DisplayName = displayName;
        environment.RequiresApproval = request.RequiresApproval;
        environment.Position = request.Position;
        environment.Version += 1;
        environment.UpdatedBy = actorId;
        environment.UpdatedAt = now;
        AppendEnvironmentAudit(environment, actorId, "environment-updated", now);
        await SaveChangesAsync(
            expectedVersion, "environment-version-conflict", cancellationToken)
            .ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToResult(environment);
    }

    internal async Task<EnvironmentRecord> GetRequiredAsync(
        string tenantId,
        string environmentName,
        CancellationToken cancellationToken)
    {
        string name = ValidateEnvironmentName(environmentName);
        return await _database.Environments.SingleOrDefaultAsync(
            item => item.TenantId == tenantId && item.Name == name,
            cancellationToken).ConfigureAwait(false)
            ?? throw Problem(StatusCodes.Status404NotFound, "environment-not-found",
                $"Environment '{name}' does not exist.");
    }

    private void AppendEnvironmentAudit(
        EnvironmentRecord environment,
        string actorId,
        string eventType,
        DateTimeOffset now)
    {
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = environment.TenantId,
            Subject = environment.Name,
            EventType = eventType,
            PayloadJson = JsonSerializer.Serialize(new
            {
                environment.DisplayName,
                environment.RequiresApproval,
                environment.Position,
                environment.Version,
            }),
            ActorId = actorId,
            OccurredAt = now,
        });
    }
}
