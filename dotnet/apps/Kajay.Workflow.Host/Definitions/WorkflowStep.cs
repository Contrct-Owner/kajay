using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Definitions;

internal sealed class WorkflowStep
{
    internal required string Key { get; init; }

    internal required WorkflowStepKind Kind { get; init; }

    internal string? Next { get; init; }

    internal string? SurveyDefinitionDigest { get; init; }

    internal TimeSpan? Delay { get; init; }

    internal string? EffectType { get; init; }

    internal JsonNode? EffectPayload { get; init; }

    internal string? AssignedPermission { get; init; }

    internal string? ApprovedNext { get; init; }

    internal string? DeniedNext { get; init; }

    internal string? ChangesRequestedNext { get; init; }

    internal IEnumerable<WorkflowTransition> Transitions()
    {
        if (Kind == WorkflowStepKind.Review)
        {
            yield return new WorkflowTransition(ApprovedNext!, ReviewDecisions.Approved);
            yield return new WorkflowTransition(DeniedNext!, ReviewDecisions.Denied);
            yield return new WorkflowTransition(
                ChangesRequestedNext!,
                ReviewDecisions.ChangesRequested);
        }
        else if (Next is not null)
        {
            yield return new WorkflowTransition(Next, null);
        }
    }
}
