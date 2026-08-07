using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Workflows;

internal sealed partial class WorkflowApplication
{
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

    internal async Task<IReadOnlyList<SurveySubmissionResult>> GetSubmissionsAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        _ = await LoadInstanceAsync(tenantId, instanceId, tracked: false, cancellationToken)
            .ConfigureAwait(false);
        return await database.SurveySubmissions
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.WorkflowInstanceId == instanceId)
            .OrderBy(item => item.SubmittedAt)
            .ThenBy(item => item.Id)
            .Select(item => SurveySubmissionResult.From(item))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task<IReadOnlyList<ReviewTaskResult>> GetReviewTasksAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        _ = await LoadInstanceAsync(tenantId, instanceId, tracked: false, cancellationToken)
            .ConfigureAwait(false);
        return await database.ReviewTasks
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.WorkflowInstanceId == instanceId)
            .OrderBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Select(item => ReviewTaskResult.From(item))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
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
}
