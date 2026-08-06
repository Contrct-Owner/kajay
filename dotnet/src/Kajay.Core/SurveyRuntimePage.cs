using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimePage(
    string Name,
    SurveyRuntimeCondition Condition,
    IReadOnlyList<SurveyRuntimeCondition> ElementConditions,
    IReadOnlyList<SurveyRuntimeQuestion> Questions)
{
    public static SurveyRuntimePage From(JsonNode? node, int pageIndex)
    {
        JsonArray? elements = node?["elements"] as JsonArray;
        SurveyRuntimeQuestion[] questions = elements is null
            ? []
            : SurveyRuntimeQuestion.FromElements(elements);
        return new SurveyRuntimePage(
            node?["name"]?.GetValue<string>() ?? string.Empty,
            SurveyRuntimeCondition.Page(node, pageIndex),
            elements is null
                ? []
                : SurveyRuntimeCondition.FromElements(elements, pageIndex),
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
