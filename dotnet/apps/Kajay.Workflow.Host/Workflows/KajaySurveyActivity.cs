using Elsa.Workflows;
using Elsa.Workflows.Models;

namespace Kajay.Workflow.Host.Workflows;

public sealed class KajaySurveyActivity : Activity
{
    public KajaySurveyActivity()
    {
    }

    internal KajaySurveyActivity(string stepKey, string definitionDigest)
    {
        StepKey = stepKey;
        DefinitionDigest = definitionDigest;
    }

    public string DefinitionDigest { get; set; } = string.Empty;

    public string StepKey { get; set; } = string.Empty;

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        (string tenantId, Guid instanceId) = ElsaWorkflowContext.Read(context);
        WorkflowProjection projection = context.GetRequiredService<WorkflowProjection>();
        await projection.EnterSurveyAsync(
            tenantId,
            instanceId,
            StepKey,
            DefinitionDigest,
            context.CancellationToken).ConfigureAwait(false);
        _ = context.CreateBookmark(new CreateBookmarkArgs
        {
            BookmarkName = ElsaWorkflowBookmarks.Survey(StepKey),
            AutoBurn = true,
            AutoComplete = true,
        });
    }
}
