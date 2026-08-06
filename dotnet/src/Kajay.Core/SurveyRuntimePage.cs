using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimePage(
    string Name,
    IReadOnlyList<SurveyRuntimeQuestion> Questions)
{
    public static SurveyRuntimePage From(JsonNode? node)
    {
        JsonArray? elements = node?["elements"] as JsonArray;
        SurveyRuntimeQuestion[] questions = elements is null
            ? []
            : SurveyRuntimeQuestion.FromElements(elements);
        return new SurveyRuntimePage(
            node?["name"]?.GetValue<string>() ?? string.Empty,
            questions);
    }

    internal bool ContainsQuestion(string questionName)
    {
        return Questions.Any(question => string.Equals(
            question.Name,
            questionName,
            StringComparison.Ordinal));
    }
}
