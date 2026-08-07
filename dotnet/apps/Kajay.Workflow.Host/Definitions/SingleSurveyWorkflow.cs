using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Definitions;

internal static class SingleSurveyWorkflow
{
    internal static WorkflowDefinition Create(string surveyDigest)
    {
        var root = new JsonObject
        {
            ["formatVersion"] = 1,
            ["initialStep"] = "survey",
            ["steps"] = new JsonArray(
                new JsonObject
                {
                    ["key"] = "survey",
                    ["kind"] = "survey",
                    ["surveyDefinitionDigest"] = surveyDigest,
                    ["next"] = "end",
                },
                new JsonObject { ["key"] = "end", ["kind"] = "end" }),
        };
        return WorkflowDefinition.Parse(root.ToJsonString());
    }
}
