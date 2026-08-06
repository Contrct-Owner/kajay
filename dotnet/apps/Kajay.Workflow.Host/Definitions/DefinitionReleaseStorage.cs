using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Definitions;

internal static class DefinitionReleaseStorage
{
    internal static DefinitionReleaseRecord ToRecord(
        string tenantId,
        DefinitionReleaseContent content,
        byte[] bundle,
        DateTimeOffset installedAt)
    {
        return new DefinitionReleaseRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            Digest = DefinitionReleaseDigest.Compute(content),
            ManagedDefinitionName = content.ManagedDefinitionName,
            VersionLabel = content.VersionLabel,
            ConformanceVersion = content.ConformanceVersion,
            WorkflowJson = content.Workflow.ToCanonicalJson(),
            SurveyDefinitionsJson = WriteSurveys(content.SurveyDefinitions),
            RequiredBindings = content.RequiredBindings.ToArray(),
            Bundle = bundle,
            InstalledAt = installedAt,
        };
    }

    internal static WorkflowDefinition ReadWorkflow(DefinitionReleaseRecord release)
    {
        return WorkflowDefinition.Parse(release.WorkflowJson);
    }

    internal static IReadOnlyDictionary<string, string> ReadSurveys(
        DefinitionReleaseRecord release)
    {
        JsonObject root = JsonNode.Parse(release.SurveyDefinitionsJson) as JsonObject
            ?? throw new InvalidDataException("Stored survey definitions must be a JSON object.");
        return root.ToDictionary(
            pair => pair.Key,
            pair => pair.Value?.ToJsonString()
                ?? throw new InvalidDataException("A stored survey definition cannot be null."),
            StringComparer.Ordinal);
    }

    private static string WriteSurveys(IReadOnlyDictionary<string, string> definitions)
    {
        var root = new JsonObject();
        foreach ((string digest, string definition) in definitions
            .OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            root[digest] = JsonNode.Parse(definition);
        }
        return root.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }
}
