using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;
using Kajay.Workflow.Host.Workflows;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class WorkflowWorkerApplication(
    WorkflowDbContext database,
    WorkflowReleaseResolver releases,
    WorkflowAudit audit,
    TimeProvider timeProvider)
{
    internal async Task<Guid> CompleteEffectAsync(
        OutboxLease lease,
        CancellationToken cancellationToken)
    {
        OutboxMessageRecord message = await database.OutboxMessages.SingleOrDefaultAsync(
            item => item.Id == lease.MessageId
                && item.LeaseToken == lease.LeaseToken
                && item.Status == "leased",
            cancellationToken).ConfigureAwait(false)
            ?? throw new InvalidOperationException("The outbox lease is no longer current.");
        WorkflowInstanceRecord instance = await LoadInstanceAsync(
            message.TenantId,
            message.WorkflowInstanceId,
            cancellationToken).ConfigureAwait(false);
        WorkflowRelease release = await releases.ResolveAsync(
            instance.TenantId,
            instance.ReleaseDigest,
            cancellationToken).ConfigureAwait(false);
        WorkflowStep step = RequireStep(instance, release, WorkflowStepKind.Effect, "waiting-effect");
        string expectedEffectId = $"{instance.Id:N}:{step.Key}:effect";
        if (!string.Equals(message.EffectId, expectedEffectId, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The outbox message does not own the active effect.");
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        message.Status = "delivered";
        message.DeliveredAt = now;
        message.LeaseToken = null;
        message.LeaseUntil = null;
        var resume = new WorkflowResumeRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = instance.TenantId,
            WorkflowInstanceId = instance.Id,
            DispatchId = $"effect:{message.EffectId}",
            Kind = "effect",
            StepKey = step.Key,
            Status = "pending",
            AvailableAt = now,
            CreatedAt = now,
        };
        database.WorkflowResumes.Add(resume);
        Touch(instance, now);
        audit.Append(instance, "effect-delivered", new
        {
            effectId = message.EffectId,
            effectType = message.EffectType,
            nextStepKey = step.Next,
        }, "workflow-worker", now);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return resume.Id;
    }

    private async Task<WorkflowInstanceRecord> LoadInstanceAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        return await database.WorkflowInstances.SingleOrDefaultAsync(
            item => item.TenantId == tenantId && item.Id == instanceId,
            cancellationToken).ConfigureAwait(false)
            ?? throw new InvalidOperationException("The Workflow Instance no longer exists.");
    }

    private static WorkflowStep RequireStep(
        WorkflowInstanceRecord instance,
        WorkflowRelease release,
        WorkflowStepKind kind,
        string status)
    {
        WorkflowStep step = release.Workflow.GetStep(instance.ActiveStepKey);
        if (step.Kind != kind || !string.Equals(instance.Status, status, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The leased work does not match the active step.");
        }
        return step;
    }

    private static void Touch(WorkflowInstanceRecord instance, DateTimeOffset now)
    {
        instance.Version += 1;
        instance.UpdatedAt = now;
    }
}
