using Elsa.Workflows;
using Elsa.Workflows.Models;

namespace Kajay.Workflow.Host.Workflows;

public sealed class KajayEffectActivity : Activity
{
    public KajayEffectActivity()
    {
    }

    internal KajayEffectActivity(string stepKey, string effectType, string payloadJson)
    {
        StepKey = stepKey;
        EffectType = effectType;
        PayloadJson = payloadJson;
    }

    public string EffectType { get; set; } = string.Empty;

    public string PayloadJson { get; set; } = "{}";

    public string StepKey { get; set; } = string.Empty;

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        await context.GetRequiredService<WorkflowProjection>().EnterEffectAsync(
            tenantId,
            instanceId,
            StepKey,
            EffectType,
            PayloadJson,
            context.CancellationToken).ConfigureAwait(false);
        _ = context.CreateBookmark(new CreateBookmarkArgs
        {
            BookmarkName = ElsaWorkflowBookmarks.Effect(StepKey),
            AutoBurn = true,
            AutoComplete = true,
        });
    }
}
