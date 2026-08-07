using Elsa.Workflows;

namespace Kajay.Workflow.Host.Workflows;

public sealed class KajayDelayCompletedActivity : Activity
{
    public KajayDelayCompletedActivity()
    {
    }

    internal KajayDelayCompletedActivity(string stepKey, string nextStepKey)
    {
        StepKey = stepKey;
        NextStepKey = nextStepKey;
    }

    public string NextStepKey { get; set; } = string.Empty;

    public string StepKey { get; set; } = string.Empty;

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        await context.GetRequiredService<WorkflowProjection>().CompleteDelayAsync(
            tenantId,
            instanceId,
            StepKey,
            NextStepKey,
            context.CancellationToken).ConfigureAwait(false);
        await context.CompleteActivityAsync().ConfigureAwait(false);
    }
}
