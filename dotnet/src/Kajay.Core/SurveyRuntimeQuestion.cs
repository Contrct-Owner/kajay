using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeQuestion(
    string Name,
    bool HasCorrectAnswer,
    KajayValue CorrectAnswer,
    IReadOnlyList<SurveyRuntimeValidator> Validators)
{
    public static SurveyRuntimeQuestion From(JsonObject element)
    {
        JsonArray? validators = element["validators"] as JsonArray;
        SurveyRuntimeValidator[] runtimeValidators = validators is null
            ? []
            : validators
                .OfType<JsonObject>()
                .Select(SurveyRuntimeValidator.From)
                .ToArray();
        bool hasCorrectAnswer = element.TryGetPropertyValue(
            "correctAnswer",
            out JsonNode? correctAnswer);
        return new SurveyRuntimeQuestion(
            element["name"]?.GetValue<string>() ?? string.Empty,
            hasCorrectAnswer,
            hasCorrectAnswer ? KajayJsonValue.From(correctAnswer) : KajayValue.Absent,
            runtimeValidators);
    }
}
