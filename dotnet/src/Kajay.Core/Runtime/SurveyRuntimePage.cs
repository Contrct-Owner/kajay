using System.Text.Json.Nodes;

namespace Kajay.Runtime;

internal sealed record SurveyRuntimePage(
    string Name,
    SurveyLocalizedText Title,
    SurveyRuntimeCondition Condition,
    IReadOnlyList<SurveyRuntimeCondition> ElementConditions,
    IReadOnlyList<SurveyRuntimeQuestion> Questions)
{
    public static SurveyRuntimePage From(
        JsonNode? node,
        int pageIndex,
        SurveyDefinitionRegistry registry)
    {
        JsonArray? elements = node?["elements"] as JsonArray;
        SurveyRuntimeQuestion[] questions = elements is null
            ? []
            : SurveyRuntimeQuestion.FromElements(elements, registry);
        return new SurveyRuntimePage(
            node?["name"]?.GetValue<string>() ?? string.Empty,
            SurveyLocalizedText.From(node?["title"]),
            SurveyRuntimeCondition.Page(node, pageIndex),
            elements is null
                ? []
                : SurveyRuntimeCondition.FromElements(elements, pageIndex, registry),
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
