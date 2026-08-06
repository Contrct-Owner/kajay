using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeQuestion(
    string Name,
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
        return new SurveyRuntimeQuestion(
            element["name"]?.GetValue<string>() ?? string.Empty,
            runtimeValidators);
    }
}
