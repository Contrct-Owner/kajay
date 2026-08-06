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
}
