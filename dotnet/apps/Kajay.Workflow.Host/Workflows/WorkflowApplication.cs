using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowApplication(
    WorkflowDbContext database,
    WorkflowReleaseResolver releases,
    IdempotencyCoordinator idempotency,
    WorkflowStepEntry stepEntry,
    WorkflowAudit audit,
    TimeProvider timeProvider)
{
    internal async Task<WorkflowInstanceResult> StartAsync(
        string tenantId,
        string actorId,
        string environmentName,
        string managedDefinitionName,
        string idempotencyKey,
        CancellationToken cancellationToken)
    {
        const string operation = "start-workflow";
        string requestHash = WorkflowCommandIdentity.Compute(
            operation,
            environmentName,
            managedDefinitionName);
        await using IDbContextTransaction transaction = await idempotency.BeginAsync(
            tenantId, idempotencyKey, cancellationToken).ConfigureAwait(false);
        WorkflowInstanceResult? repeated = await idempotency.FindAsync<WorkflowInstanceResult>(
            tenantId,
            idempotencyKey,
            operation,
            requestHash,
            cancellationToken).ConfigureAwait(false);
        if (repeated is not null)
        {
            return repeated;
        }

        WorkflowRelease release = await releases.ResolveActiveAsync(
            tenantId,
            environmentName,
            managedDefinitionName,
            cancellationToken).ConfigureAwait(false);
        DateTimeOffset now = timeProvider.GetUtcNow();
        var instance = new WorkflowInstanceRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            EnvironmentName = environmentName,
            ManagedDefinitionName = managedDefinitionName,
            ReleaseDigest = release.Record.Digest,
            Status = "starting",
            ActiveStepKey = release.Workflow.InitialStep,
            Version = 1,
            NextAuditSequence = 1,
            StartedAt = now,
            UpdatedAt = now,
        };
        database.WorkflowInstances.Add(instance);
        stepEntry.Enter(instance, release, release.Workflow.InitialStep, now);
        audit.Append(instance, "workflow-started", new
        {
            instance.ReleaseDigest,
            instance.ActiveStepKey,
        }, actorId, now);
        WorkflowInstanceResult result = WorkflowInstanceResult.From(instance);
        idempotency.Add(tenantId, idempotencyKey, operation, requestHash, result);
        await CommitAsync(instance.Version, cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return result;
    }

    internal async Task<WorkflowInstanceResult> GetAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceRecord instance = await LoadInstanceAsync(
            tenantId,
            instanceId,
            tracked: false,
            cancellationToken).ConfigureAwait(false);
        return WorkflowInstanceResult.From(instance);
    }

    internal async Task<IReadOnlyList<WorkflowAuditEventResult>> GetAuditAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        _ = await LoadInstanceAsync(tenantId, instanceId, tracked: false, cancellationToken)
            .ConfigureAwait(false);
        return await database.WorkflowAuditEvents
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.WorkflowInstanceId == instanceId)
            .OrderBy(item => item.Sequence)
            .Select(item => WorkflowAuditEventResult.From(item))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task<WorkflowInstanceResult> SaveResponseAsync(
        string tenantId,
        string actorId,
        Guid instanceId,
        long expectedVersion,
        string idempotencyKey,
        string snapshotJson,
        CancellationToken cancellationToken)
    {
        const string operation = "save-response";
        string requestHash = WorkflowCommandIdentity.Compute(
            operation,
            instanceId.ToString("N"),
            expectedVersion.ToString(System.Globalization.CultureInfo.InvariantCulture),
            snapshotJson);
        await using IDbContextTransaction transaction = await idempotency.BeginAsync(
            tenantId, idempotencyKey, cancellationToken).ConfigureAwait(false);
        WorkflowInstanceResult? repeated = await FindRepeatedAsync(
            tenantId, idempotencyKey, operation, requestHash, cancellationToken)
            .ConfigureAwait(false);
        if (repeated is not null)
        {
            return repeated;
        }

        WorkflowInstanceRecord instance = await LoadInstanceAsync(
            tenantId, instanceId, tracked: true, cancellationToken).ConfigureAwait(false);
        EnsureVersion(instance, expectedVersion);
        WorkflowRelease release = await releases.ResolveAsync(
            tenantId, instance.ReleaseDigest, cancellationToken).ConfigureAwait(false);
        WorkflowStep step = RequireSurveyStep(instance, release);
        Kajay.Snapshots.SurveySnapshot snapshot = WorkflowResponseValidator.Validate(
            release, step, snapshotJson);
        instance.ResponseSnapshotJson = snapshot.ToJson();
        Touch(instance);
        DateTimeOffset now = timeProvider.GetUtcNow();
        audit.Append(instance, "survey-response-saved", new { stepKey = step.Key }, actorId, now);
        WorkflowInstanceResult result = WorkflowInstanceResult.From(instance);
        idempotency.Add(tenantId, idempotencyKey, operation, requestHash, result);
        await CommitAsync(expectedVersion, cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return result;
    }

    internal async Task<WorkflowInstanceResult> CompleteSurveyAsync(
        string tenantId,
        string actorId,
        Guid instanceId,
        long expectedVersion,
        string idempotencyKey,
        CancellationToken cancellationToken)
    {
        const string operation = "complete-survey-step";
        string requestHash = WorkflowCommandIdentity.Compute(
            operation,
            instanceId.ToString("N"),
            expectedVersion.ToString(System.Globalization.CultureInfo.InvariantCulture));
        await using IDbContextTransaction transaction = await idempotency.BeginAsync(
            tenantId, idempotencyKey, cancellationToken).ConfigureAwait(false);
        WorkflowInstanceResult? repeated = await FindRepeatedAsync(
            tenantId, idempotencyKey, operation, requestHash, cancellationToken)
            .ConfigureAwait(false);
        if (repeated is not null)
        {
            return repeated;
        }

        WorkflowInstanceRecord instance = await LoadInstanceAsync(
            tenantId, instanceId, tracked: true, cancellationToken).ConfigureAwait(false);
        EnsureVersion(instance, expectedVersion);
        WorkflowRelease release = await releases.ResolveAsync(
            tenantId, instance.ReleaseDigest, cancellationToken).ConfigureAwait(false);
        WorkflowStep step = RequireSurveyStep(instance, release);
        WorkflowResponseValidator.RequireCompleted(instance, release, step);
        DateTimeOffset now = timeProvider.GetUtcNow();
        stepEntry.Enter(instance, release, step.Next!, now);
        Touch(instance);
        audit.Append(instance, "survey-step-completed", new
        {
            stepKey = step.Key,
            nextStepKey = instance.ActiveStepKey,
        }, actorId, now);
        WorkflowInstanceResult result = WorkflowInstanceResult.From(instance);
        idempotency.Add(tenantId, idempotencyKey, operation, requestHash, result);
        await CommitAsync(expectedVersion, cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return result;
    }

    private async Task<WorkflowInstanceResult?> FindRepeatedAsync(
        string tenantId,
        string key,
        string operation,
        string requestHash,
        CancellationToken cancellationToken)
    {
        return await idempotency.FindAsync<WorkflowInstanceResult>(
            tenantId, key, operation, requestHash, cancellationToken).ConfigureAwait(false);
    }

    private async Task<WorkflowInstanceRecord> LoadInstanceAsync(
        string tenantId,
        Guid instanceId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        IQueryable<WorkflowInstanceRecord> query = database.WorkflowInstances;
        if (!tracked)
        {
            query = query.AsNoTracking();
        }
        return await query.SingleOrDefaultAsync(
            item => item.TenantId == tenantId && item.Id == instanceId,
            cancellationToken).ConfigureAwait(false)
            ?? throw new WorkflowProblemException(
                StatusCodes.Status404NotFound,
                "workflow-instance-not-found",
                $"Workflow Instance '{instanceId}' does not exist.");
    }

    private static WorkflowStep RequireSurveyStep(
        WorkflowInstanceRecord instance,
        WorkflowRelease release)
    {
        WorkflowStep step = release.Workflow.GetStep(instance.ActiveStepKey);
        if (step.Kind != WorkflowStepKind.Survey || !string.Equals(
            instance.Status,
            "active",
            StringComparison.Ordinal))
        {
            throw new WorkflowProblemException(
                StatusCodes.Status409Conflict,
                "survey-step-not-active",
                "The Workflow Instance is not waiting on an active survey step.");
        }
        return step;
    }

    private static void EnsureVersion(WorkflowInstanceRecord instance, long expectedVersion)
    {
        if (instance.Version != expectedVersion)
        {
            throw VersionConflict(expectedVersion, instance.Version);
        }
    }

    private void Touch(WorkflowInstanceRecord instance)
    {
        instance.Version += 1;
        instance.UpdatedAt = timeProvider.GetUtcNow();
    }

    private async Task CommitAsync(long expectedVersion, CancellationToken cancellationToken)
    {
        try
        {
            await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw VersionConflict(expectedVersion, null);
        }
    }

    private static WorkflowProblemException VersionConflict(long expected, long? actual)
    {
        string actualText = actual?.ToString(System.Globalization.CultureInfo.InvariantCulture)
            ?? "unknown";
        return new WorkflowProblemException(
            StatusCodes.Status412PreconditionFailed,
            "workflow-version-conflict",
            $"Expected Workflow Instance version {expected}, but current is {actualText}.");
    }
}
