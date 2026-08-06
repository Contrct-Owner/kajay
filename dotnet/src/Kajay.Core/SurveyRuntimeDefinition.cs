using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeDefinition(
    IReadOnlyList<SurveyRuntimePage> Pages,
    IReadOnlyList<SurveyRuntimeCalculatedValue> CalculatedValues,
    TimeSpan SurveyTimeLimit,
    TimeSpan DefaultPageTimeLimit,
    IReadOnlyList<TimeSpan> PageTimeLimits)
{
    public int PageCount => Pages.Count;

    public static SurveyRuntimeDefinition From(JsonObject definition)
    {
        JsonArray? pages = definition["pages"] as JsonArray;
        SurveyRuntimePage[] runtimePages = pages is null
            ? []
            : pages.Select(SurveyRuntimePage.From).ToArray();
        JsonArray? calculatedValues = definition["calculatedValues"] as JsonArray;
        SurveyRuntimeCalculatedValue[] runtimeCalculatedValues = calculatedValues is null
            ? []
            : calculatedValues
                .OfType<JsonObject>()
                .Select(SurveyRuntimeCalculatedValue.From)
                .ToArray();
        TimeSpan[] pageTimeLimits = pages is null
            ? []
            : pages.Select(page => ReadSeconds(page?["maxTimeToFinish"])).ToArray();
        return new SurveyRuntimeDefinition(
            runtimePages,
            runtimeCalculatedValues,
            ReadSeconds(definition["maxTimeToFinish"]),
            ReadSeconds(definition["maxTimeToFinishPage"]),
            pageTimeLimits);
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
