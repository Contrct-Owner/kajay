using System.Text.Json.Nodes;

namespace Kajay.Runtime;

internal sealed record SurveyRuntimeDefinition(
    SurveyDefinitionRegistry Registry,
    SurveyLocalizedText Title,
    SurveyLocalizedText Description,
    string Locale,
    IReadOnlyList<SurveyRuntimePage> Pages,
    IReadOnlyList<SurveyRuntimeCalculatedValue> CalculatedValues,
    IReadOnlyList<SurveyRuntimeTrigger> Triggers,
    bool ValidationEnabled,
    SurveyValidationMode ValidationMode,
    TimeSpan SurveyTimeLimit,
    TimeSpan DefaultPageTimeLimit,
    IReadOnlyList<TimeSpan> PageTimeLimits)
{
    public int PageCount => Pages.Count;

    public IReadOnlyList<SurveyRuntimeCondition> Conditions => Pages
        .SelectMany(page => page.ElementConditions.Prepend(page.Condition))
        .ToArray();

    public static SurveyRuntimeDefinition From(
        JsonObject definition,
        SurveyDefinitionRegistry registry)
    {
        JsonArray? pages = definition["pages"] as JsonArray;
        SurveyRuntimePage[] runtimePages = pages is null
            ? []
            : pages.Select((page, index) => SurveyRuntimePage.From(page, index, registry)).ToArray();
        JsonArray? calculatedValues = definition["calculatedValues"] as JsonArray;
        SurveyRuntimeCalculatedValue[] runtimeCalculatedValues = calculatedValues is null
            ? []
            : calculatedValues
                .OfType<JsonObject>()
                .Select(SurveyRuntimeCalculatedValue.From)
                .ToArray();
        JsonArray? triggers = definition["triggers"] as JsonArray;
        SurveyRuntimeTrigger[] runtimeTriggers = triggers is null
            ? []
            : triggers
                .OfType<JsonObject>()
                .Select(SurveyRuntimeTrigger.From)
                .OfType<SurveyRuntimeTrigger>()
                .ToArray();
        TimeSpan[] pageTimeLimits = pages is null
            ? []
            : pages.Select(page => ReadSeconds(page?["maxTimeToFinish"])).ToArray();
        return new SurveyRuntimeDefinition(
            registry,
            SurveyLocalizedText.From(definition["title"]),
            SurveyLocalizedText.From(definition["description"]),
            definition["locale"]?.GetValue<string>() ?? string.Empty,
            runtimePages,
            runtimeCalculatedValues,
            runtimeTriggers,
            definition["validationEnabled"]?.GetValue<bool>() ?? true,
            ReadValidationMode(definition["checkErrorsMode"]),
            ReadSeconds(definition["maxTimeToFinish"]),
            ReadSeconds(definition["maxTimeToFinishPage"]),
            pageTimeLimits);
    }

    private static SurveyValidationMode ReadValidationMode(JsonNode? node)
    {
        return node?.GetValue<string>() switch
        {
            "onValueChanged" => SurveyValidationMode.OnValueChanged,
            "onComplete" => SurveyValidationMode.OnComplete,
            _ => SurveyValidationMode.OnNextPage,
        };
    }

    private static TimeSpan ReadSeconds(JsonNode? node)
    {
        if (node is not JsonValue value
            || !value.TryGetValue(out double seconds)
            || !double.IsFinite(seconds)
            || seconds <= 0
            || seconds > TimeSpan.MaxValue.TotalSeconds)
        {
            return TimeSpan.Zero;
        }

        return TimeSpan.FromSeconds(seconds);
    }
}
