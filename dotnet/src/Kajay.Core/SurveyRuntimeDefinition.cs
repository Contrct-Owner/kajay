using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeDefinition(
    int PageCount,
    TimeSpan SurveyTimeLimit,
    TimeSpan DefaultPageTimeLimit,
    IReadOnlyList<TimeSpan> PageTimeLimits)
{
    public static SurveyRuntimeDefinition From(JsonObject definition)
    {
        JsonArray? pages = definition["pages"] as JsonArray;
        TimeSpan[] pageTimeLimits = pages is null
            ? []
            : pages.Select(page => ReadSeconds(page?["maxTimeToFinish"])).ToArray();
        return new SurveyRuntimeDefinition(
            pages?.Count ?? 0,
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
