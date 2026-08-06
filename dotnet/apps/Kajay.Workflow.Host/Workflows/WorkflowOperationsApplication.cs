using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowOperationsApplication(WorkflowDbContext database)
{
    internal async Task<WorkflowWorkResult> GetWorkAsync(
        string tenantId,
        Guid instanceId,
        CancellationToken cancellationToken)
    {
        bool exists = await database.WorkflowInstances.AnyAsync(
            item => item.TenantId == tenantId && item.Id == instanceId,
            cancellationToken).ConfigureAwait(false);
        if (!exists)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status404NotFound,
                "workflow-instance-not-found",
                $"Workflow Instance '{instanceId}' does not exist.");
        }

        EffectDeliveryResult[] effects = await database.OutboxMessages
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.WorkflowInstanceId == instanceId)
            .OrderBy(item => item.CreatedAt)
            .Select(item => new EffectDeliveryResult(
                item.EffectId,
                item.EffectType,
                item.Status,
                item.Attempts,
                item.AvailableAt,
                item.LastError,
                item.DeliveredAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        ScheduledActionResult[] actions = await database.ScheduledActions
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.WorkflowInstanceId == instanceId)
            .OrderBy(item => item.CreatedAt)
            .Select(item => new ScheduledActionResult(
                item.ActionId,
                item.StepKey,
                item.Status,
                item.Attempts,
                item.DueAt,
                item.LastError,
                item.CompletedAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        return new WorkflowWorkResult(effects, actions);
    }
}
