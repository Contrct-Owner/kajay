using Kajay.Workflow.Host.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Workflows;

internal sealed partial class WorkflowApplication
{
    private async Task<WorkflowInstanceResult> EnsureStartedAsync(
        string tenantId,
        string idempotencyKey,
        WorkflowInstanceResult stored,
        Guid? resumeId,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult current = await ReloadAsync(
            tenantId, stored.Id, cancellationToken).ConfigureAwait(false);
        if (current.Status == "starting")
        {
            Guid pendingResumeId = resumeId ?? await FindResumeIdAsync(
                tenantId, current.Id, "start", cancellationToken).ConfigureAwait(false);
            await resumeProcessor.ResumeNowAsync(pendingResumeId, cancellationToken)
                .ConfigureAwait(false);
            current = await ReloadAsync(tenantId, current.Id, cancellationToken)
                .ConfigureAwait(false);
        }
        await idempotency.UpdateResultAsync(
            tenantId, idempotencyKey, current, cancellationToken).ConfigureAwait(false);
        return current;
    }

    private async Task<WorkflowInstanceResult> EnsureSubmissionResumedAsync(
        string tenantId,
        string idempotencyKey,
        WorkflowInstanceResult stored,
        Guid? resumeId,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult current = await ReloadAsync(
            tenantId, stored.Id, cancellationToken).ConfigureAwait(false);
        if (current.Status == "submitted")
        {
            Guid pendingResumeId = resumeId ?? await FindResumeIdAsync(
                tenantId, current.Id, "survey", cancellationToken)
                .ConfigureAwait(false);
            await resumeProcessor.ResumeNowAsync(pendingResumeId, cancellationToken)
                .ConfigureAwait(false);
            current = await ReloadAsync(tenantId, current.Id, cancellationToken)
                .ConfigureAwait(false);
        }
        await idempotency.UpdateResultAsync(
            tenantId, idempotencyKey, current, cancellationToken).ConfigureAwait(false);
        return current;
    }

    private async Task<WorkflowInstanceResult> EnsureReviewResumedAsync(
        string tenantId,
        string idempotencyKey,
        WorkflowInstanceResult stored,
        Guid? resumeId,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult current = await ReloadAsync(
            tenantId, stored.Id, cancellationToken).ConfigureAwait(false);
        if (current.Status == "review-decided")
        {
            Guid pendingResumeId = resumeId ?? await FindResumeIdAsync(
                tenantId, current.Id, "review", cancellationToken).ConfigureAwait(false);
            await resumeProcessor.ResumeNowAsync(pendingResumeId, cancellationToken)
                .ConfigureAwait(false);
            current = await ReloadAsync(tenantId, current.Id, cancellationToken)
                .ConfigureAwait(false);
        }
        await idempotency.UpdateResultAsync(
            tenantId, idempotencyKey, current, cancellationToken).ConfigureAwait(false);
        return current;
    }

    private async Task<Guid> FindResumeIdAsync(
        string tenantId,
        Guid instanceId,
        string kind,
        CancellationToken cancellationToken)
    {
        return await database.WorkflowResumes
            .Where(item => item.TenantId == tenantId
                && item.WorkflowInstanceId == instanceId
                && item.Kind == kind)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => item.Id)
            .FirstAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<WorkflowInstanceResult> ReloadAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        database.ChangeTracker.Clear();
        return await GetAsync(tenantId, instanceId, cancellationToken).ConfigureAwait(false);
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
}
