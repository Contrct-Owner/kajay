using Elsa.Workflows;
using Elsa.Workflows.Activities.Flowchart.Attributes;
using Elsa.Workflows.Models;
using Kajay.Workflow.Host.Definitions;

namespace Kajay.Workflow.Host.Workflows;

[FlowNode(
    ReviewDecisions.Approved,
    ReviewDecisions.Denied,
    ReviewDecisions.ChangesRequested)]
public sealed class KajayReviewActivity : Activity
{
    public KajayReviewActivity()
    {
    }

    internal KajayReviewActivity(string stepKey, string assignedPermission)
    {
        StepKey = stepKey;
        AssignedPermission = assignedPermission;
    }

    public string AssignedPermission { get; set; } = string.Empty;

    public string StepKey { get; set; } = string.Empty;

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        WorkflowProjection projection = context.GetRequiredService<WorkflowProjection>();
        await projection.EnterReviewAsync(
            tenantId,
            instanceId,
            StepKey,
            AssignedPermission,
            context.CancellationToken).ConfigureAwait(false);
        _ = context.CreateBookmark(new CreateBookmarkArgs
        {
            BookmarkName = ElsaWorkflowBookmarks.Review(StepKey),
            AutoBurn = true,
            AutoComplete = false,
            Callback = OnDecisionReceivedAsync,
        });
    }

    private async ValueTask OnDecisionReceivedAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        WorkflowProjection projection = context.GetRequiredService<WorkflowProjection>();
        string outcome = await projection.GetReviewOutcomeAsync(
            tenantId,
            instanceId,
            StepKey,
            context.CancellationToken).ConfigureAwait(false);
        await context.CompleteActivityWithOutcomesAsync(outcome).ConfigureAwait(false);
    }
}
