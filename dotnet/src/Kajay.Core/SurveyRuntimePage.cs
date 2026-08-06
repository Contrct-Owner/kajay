using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimePage(
    IReadOnlyList<SurveyRuntimeQuestion> Questions)
{
    public static SurveyRuntimePage From(JsonNode? node)
    {
        JsonArray? elements = node?["elements"] as JsonArray;
        SurveyRuntimeQuestion[] questions = elements is null
            ? []
            : elements
                .OfType<JsonObject>()
                .Select(SurveyRuntimeQuestion.From)
                .ToArray();
        return new SurveyRuntimePage(questions);
    }
}
