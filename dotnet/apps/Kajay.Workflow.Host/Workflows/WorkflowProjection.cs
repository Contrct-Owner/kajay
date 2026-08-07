using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowProjection(
    WorkflowDbContext database,
    WorkflowReleaseResolver releases,
    WorkflowAudit audit,
    TimeProvider timeProvider)
{
    internal async Task EnterSurveyAsync(
        string tenantId,
        Guid instanceId,
        string stepKey,
        string definitionDigest,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceRecord instance = await LoadAsync(
            tenantId, instanceId, cancellationToken).ConfigureAwait(false);
        if (instance.Status == "active"
            && instance.ActiveStepKey == stepKey
            && instance.ResponseSnapshotJson is not null)
        {
            return;
        }
        WorkflowRelease release = await releases.ResolveAsync(
            tenantId, instance.ReleaseDigest, cancellationToken).ConfigureAwait(false);
        instance.ActiveStepKey = stepKey;
        instance.Status = "active";
        instance.ResponseSnapshotJson = release.GetSurvey(definitionDigest)
            .CreateSurvey().CreateSnapshot().ToJson();
        instance.UpdatedAt = timeProvider.GetUtcNow();
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task EnterDelayAsync(
        string tenantId,
        Guid instanceId,
        string stepKey,
        TimeSpan delay,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceRecord instance = await LoadAsync(
            tenantId, instanceId, cancellationToken).ConfigureAwait(false);
        DateTimeOffset now = timeProvider.GetUtcNow();
        string actionId = $"{instance.Id:N}:{stepKey}:timer";
        bool exists = await database.ScheduledActions.AnyAsync(
            item => item.TenantId == tenantId && item.ActionId == actionId,
            cancellationToken).ConfigureAwait(false);
        if (!exists)
        {
            database.ScheduledActions.Add(new ScheduledActionRecord
            {
                Id = Guid.CreateVersion7(),
                TenantId = tenantId,
                WorkflowInstanceId = instanceId,
                ActionId = actionId,
                StepKey = stepKey,
                Status = "pending",
                DueAt = now + delay,
                CreatedAt = now,
            });
        }
        SetWaiting(instance, stepKey, "waiting-delay", now);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task CompleteDelayAsync(
        string tenantId,
        Guid instanceId,
        string stepKey,
        string nextStepKey,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceRecord instance = await LoadAsync(
            tenantId, instanceId, cancellationToken).ConfigureAwait(false);
        string actionId = $"{instance.Id:N}:{stepKey}:timer";
        ScheduledActionRecord action = await database.ScheduledActions.SingleAsync(
            item => item.TenantId == tenantId && item.ActionId == actionId,
            cancellationToken).ConfigureAwait(false);
        if (action.Status == "completed")
        {
            return;
        }
        DateTimeOffset now = timeProvider.GetUtcNow();
        action.Status = "completed";
        action.CompletedAt = now;
        action.LeaseToken = null;
        action.LeaseUntil = null;
        Touch(instance, now);
        audit.Append(instance, "scheduled-action-completed", new
        {
            actionId = action.ActionId,
            stepKey,
            nextStepKey,
        }, "elsa", now);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task EnterEffectAsync(
        string tenantId,
        Guid instanceId,
        string stepKey,
        string effectType,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceRecord instance = await LoadAsync(
            tenantId, instanceId, cancellationToken).ConfigureAwait(false);
        DateTimeOffset now = timeProvider.GetUtcNow();
        string effectId = $"{instance.Id:N}:{stepKey}:effect";
        bool exists = await database.OutboxMessages.AnyAsync(
            item => item.TenantId == tenantId && item.EffectId == effectId,
            cancellationToken).ConfigureAwait(false);
        if (!exists)
        {
            database.OutboxMessages.Add(new OutboxMessageRecord
            {
                Id = Guid.CreateVersion7(),
                TenantId = tenantId,
                WorkflowInstanceId = instanceId,
                EffectId = effectId,
                EffectType = effectType,
                PayloadJson = payloadJson,
                Status = "pending",
                AvailableAt = now,
                CreatedAt = now,
            });
        }
        SetWaiting(instance, stepKey, "waiting-effect", now);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task CompleteWorkflowAsync(
        string tenantId,
        Guid instanceId,
        string stepKey,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceRecord instance = await LoadAsync(
            tenantId, instanceId, cancellationToken).ConfigureAwait(false);
        if (instance.Status == "completed")
        {
            return;
        }
        DateTimeOffset now = timeProvider.GetUtcNow();
        instance.ActiveStepKey = stepKey;
        instance.Status = "completed";
        instance.ResponseSnapshotJson = null;
        instance.CompletedAt = now;
        instance.UpdatedAt = now;
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<WorkflowInstanceRecord> LoadAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        return await database.WorkflowInstances.SingleAsync(
            item => item.TenantId == tenantId && item.Id == instanceId,
            cancellationToken).ConfigureAwait(false);
    }

    private static void SetWaiting(
        WorkflowInstanceRecord instance,
        string stepKey,
        string status,
        DateTimeOffset now)
    {
        instance.ActiveStepKey = stepKey;
        instance.Status = status;
        instance.ResponseSnapshotJson = null;
        instance.UpdatedAt = now;
    }

    private static void Touch(WorkflowInstanceRecord instance, DateTimeOffset now)
    {
        instance.Version += 1;
        instance.UpdatedAt = now;
    }
}
