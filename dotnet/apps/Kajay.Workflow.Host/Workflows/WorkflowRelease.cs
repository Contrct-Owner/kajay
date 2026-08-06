using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowRelease(DefinitionReleaseRecord record)
{
    private readonly IReadOnlyDictionary<string, string> _surveys =
        DefinitionReleaseStorage.ReadSurveys(record);

    internal DefinitionReleaseRecord Record { get; } = record;

    internal WorkflowDefinition Workflow { get; } = DefinitionReleaseStorage.ReadWorkflow(record);

    internal Kajay.SurveyDefinition GetSurvey(string digest)
    {
        if (!_surveys.TryGetValue(digest, out string? json))
        {
            throw new InvalidDataException($"Release '{Record.Digest}' is missing survey '{digest}'.");
        }
        return Kajay.SurveyDefinition.Parse(json).Definition;
    }
}
