using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Definitions;

internal static class DefinitionReleaseArtifact
{
    internal static JsonNode Create(DefinitionReleaseRecord release)
    {
        JsonObject workflow = JsonNode.Parse(release.WorkflowJson) as JsonObject
            ?? throw new InvalidDataException("Stored workflow must be a JSON object.");
        JsonObject definitions = JsonNode.Parse(release.SurveyDefinitionsJson) as JsonObject
            ?? throw new InvalidDataException("Stored survey definitions must be a JSON object.");
        EmbedDefinitions(workflow, definitions);
        return new JsonObject
        {
            ["conformanceVersion"] = release.ConformanceVersion,
            ["requiredBindings"] = new JsonArray(release.RequiredBindings
                .Order(StringComparer.Ordinal).Select(item => (JsonNode?)item).ToArray()),
            ["workflow"] = workflow,
        };
    }

    private static void EmbedDefinitions(JsonObject workflow, JsonObject definitions)
    {
        JsonArray steps = workflow["steps"] as JsonArray
            ?? throw new InvalidDataException("Stored workflow steps must be an array.");
        foreach (JsonObject step in steps.OfType<JsonObject>())
        {
            if (step["kind"]?.GetValue<string>() != "survey")
            {
                continue;
            }
            string digest = step["surveyDefinitionDigest"]?.GetValue<string>()
                ?? throw new InvalidDataException("A survey step must reference a definition.");
            JsonNode definition = definitions[digest]
                ?? throw new InvalidDataException($"Stored survey definition '{digest}' is missing.");
            _ = step.Remove("surveyDefinitionDigest");
            step["definition"] = definition.DeepClone();
        }
    }
}
