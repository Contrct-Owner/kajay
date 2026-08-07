using Elsa.Workflows;

namespace Kajay.Workflow.Host.Workflows;

public sealed class KajayEndActivity : Activity
{
    public KajayEndActivity()
    {
    }

    internal KajayEndActivity(string stepKey)
    {
        StepKey = stepKey;
    }

    public string StepKey { get; set; } = string.Empty;

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        await context.GetRequiredService<WorkflowProjection>().CompleteWorkflowAsync(
            tenantId,
            instanceId,
            StepKey,
            context.CancellationToken).ConfigureAwait(false);
        await context.CompleteActivityAsync().ConfigureAwait(false);
    }
}
