using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class ResponseSnapshotV1ConformanceTests
{
    [Fact]
    public void PublicRuntimeEmitsThePortableSnapshotCorpus()
    {
        using JsonDocument corpus = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "response-snapshot",
            "v1",
            "cases.json")));
        Assert.Equal(1, corpus.RootElement.GetProperty("formatVersion").GetInt32());

        foreach (JsonElement testCase in corpus.RootElement.GetProperty("cases").EnumerateArray())
        {
            AssertCase(testCase);
        }
    }

    private static void AssertCase(JsonElement testCase)
    {
        SurveyDefinition definition = SurveyDefinition.Parse(
            testCase.GetProperty("definition").GetRawText()).Definition;
        Survey survey = testCase.TryGetProperty("clock", out JsonElement clock)
            ? definition.CreateSurvey(new SurveyOptions
            {
                TimeProvider = new FixedTimeProvider(DateTimeOffset.Parse(
                    clock.GetString()!,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind)),
            })
            : definition.CreateSurvey();
        foreach (JsonProperty answer in testCase.GetProperty("answers").EnumerateObject())
        {
            survey.SetValue(answer.Name, ReadValue(answer.Value));
        }
        _ = survey.GoToPage(testCase.GetProperty("pageName").GetString()!);
        survey.SetLocale(testCase.GetProperty("locale").GetString()!);
        string lifecycle = testCase.GetProperty("lifecycle").GetString()!;
        if (string.Equals(lifecycle, "preview", StringComparison.Ordinal)) survey.EnterPreview();
        if (string.Equals(lifecycle, "completed", StringComparison.Ordinal)) survey.Complete();
        if (testCase.TryGetProperty("startTimer", out JsonElement startTimer)
            && startTimer.GetBoolean())
        {
            survey.Timer.Start();
        }

        using JsonDocument actual = JsonDocument.Parse(survey.CreateSnapshot().ToJson());
        Assert.True(
            JsonElement.DeepEquals(testCase.GetProperty("expected"), actual.RootElement),
            $"Response Snapshot case {testCase.GetProperty("id").GetString()} differed. "
            + $"Actual: {actual.RootElement.GetRawText()}");
    }

    private static KajayValue ReadValue(JsonElement tagged)
    {
        return tagged.GetProperty("kind").GetString() switch
        {
            "absent" => KajayValue.Absent,
            "json" => ReadScalar(tagged.GetProperty("value")),
            "instant" => KajayValue.From(DateTimeOffset.ParseExact(
                tagged.GetProperty("value").GetString()!,
                "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal)),
            "array" => KajayValue.FromArray(
                tagged.GetProperty("value").EnumerateArray().Select(ReadValue)),
            "object" => KajayValue.FromObject(
                tagged.GetProperty("value").EnumerateObject().Select(property =>
                    new KeyValuePair<string, KajayValue>(property.Name, ReadValue(property.Value)))),
            string kind => throw new InvalidDataException($"Unknown snapshot value kind '{kind}'."),
            null => throw new InvalidDataException("A snapshot value kind cannot be null."),
        };
    }

    private static KajayValue ReadScalar(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.Null => KajayValue.Null,
            JsonValueKind.True => KajayValue.From(true),
            JsonValueKind.False => KajayValue.From(false),
            JsonValueKind.Number => KajayValue.From(value.GetDouble()),
            JsonValueKind.String => KajayValue.From(value.GetString()!),
            _ => throw new InvalidDataException("A tagged JSON snapshot value must be scalar."),
        };
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
