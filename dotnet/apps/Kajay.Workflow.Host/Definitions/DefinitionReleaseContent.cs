namespace Kajay.Workflow.Host.Definitions;

internal sealed class DefinitionReleaseContent
{
    internal required string ManagedDefinitionName { get; init; }

    internal required string VersionLabel { get; init; }

    internal required int ConformanceVersion { get; init; }

    internal required WorkflowDefinition Workflow { get; init; }

    internal required IReadOnlyDictionary<string, string> SurveyDefinitions { get; init; }

    internal required IReadOnlyList<string> RequiredBindings { get; init; }
}
