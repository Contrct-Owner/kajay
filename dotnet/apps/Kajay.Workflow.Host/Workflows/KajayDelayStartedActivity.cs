using Elsa.Workflows;

namespace Kajay.Workflow.Host.Workflows;

public sealed class KajayDelayStartedActivity : Activity
{
    public KajayDelayStartedActivity()
    {
    }

    internal KajayDelayStartedActivity(string stepKey, TimeSpan delay)
    {
        StepKey = stepKey;
        Delay = delay;
    }

    public TimeSpan Delay { get; set; }

    public string StepKey { get; set; } = string.Empty;

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        await context.GetRequiredService<WorkflowProjection>().EnterDelayAsync(
            tenantId,
            instanceId,
            StepKey,
            Delay,
            context.CancellationToken).ConfigureAwait(false);
        await context.CompleteActivityAsync().ConfigureAwait(false);
    }
}
