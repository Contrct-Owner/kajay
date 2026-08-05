using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class LifecycleConformanceTests
{
    [Fact]
    public void EmptyDefinitionsCreateAnEmptySurvey()
    {
        using JsonDocument corpus = OpenLifecycleCorpus();
        JsonElement scenario = corpus.RootElement
            .GetProperty("scenarios")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == "empty-definition");
        SurveyDefinition definition = SurveyDefinition.Parse(
            scenario.GetProperty("definition").GetRawText()).Definition;

        Survey survey = definition.CreateSurvey();

        Assert.Equal(
            scenario.GetProperty("initialState").GetString(),
            survey.State.ToString().ToLowerInvariant());
    }

    [Fact]
    public void RunningSurveyPublishesOrderedValueAndStateEvents()
    {
        using JsonDocument corpus = OpenLifecycleCorpus();
        JsonElement scenario = FindScenario(corpus, "running-preview-complete");
        AssertScenario(
            scenario,
            new ManualTimeProvider(DateTimeOffset.UnixEpoch));
    }

    [Fact]
    public void SurveyTimerCompletesAtTheOverallDeadline()
    {
        using JsonDocument corpus = OpenLifecycleCorpus();
        JsonElement scenario = FindScenario(corpus, "survey-timer-completes");
        DateTimeOffset start = DateTimeOffset.Parse(
            scenario.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);
        AssertScenario(scenario, new ManualTimeProvider(start));
    }

    private static void AssertScenario(
        JsonElement scenario,
        ManualTimeProvider clock)
    {
        Survey survey = SurveyDefinition.Parse(
            scenario.GetProperty("definition").GetRawText()).Definition.CreateSurvey(
                new SurveyOptions { TimeProvider = clock });
        var events = new List<ObservedLifecycleEvent>();
        survey.StateChanged += (_, args) => events.Add(
            ObservedLifecycleEvent.StateChanged(args.State));
        survey.ValueChanged += (_, args) => events.Add(
            ObservedLifecycleEvent.ValueChanged(
                args.Name,
                args.PreviousValue,
                args.Value));
        survey.Completed += (_, args) => events.Add(
            ObservedLifecycleEvent.Completed(args.Data));

        Assert.Equal(ReadState(scenario.GetProperty("initialState")), survey.State);
        foreach (JsonElement action in scenario.GetProperty("actions").EnumerateArray())
        {
            events.Clear();

            ApplyAction(survey, action, clock);

            Assert.Equal(ReadState(action.GetProperty("state")), survey.State);
            AssertEvents(action.GetProperty("events"), events);
        }
    }

    private static void ApplyAction(
        Survey survey,
        JsonElement action,
        ManualTimeProvider clock)
    {
        switch (action.GetProperty("kind").GetString())
        {
            case "set-loading":
                survey.SetLoading(action.GetProperty("value").GetBoolean());
                break;
            case "enter-preview":
                survey.EnterPreview();
                break;
            case "cancel-preview":
                survey.CancelPreview();
                break;
            case "set-value":
                survey.SetValue(
                    action.GetProperty("name").GetString()!,
                    ReadJsonValue(action.GetProperty("value")));
                break;
            case "complete":
                survey.Complete();
                break;
            case "start-timer":
                survey.Timer.Start();
                break;
            case "advance-clock":
                clock.Advance(TimeSpan.FromSeconds(
                    action.GetProperty("seconds").GetDouble()));
                survey.Timer.Tick();
                break;
            default:
                throw new InvalidOperationException("Unknown lifecycle action.");
        }
    }

    private static void AssertEvents(
        JsonElement expectedEvents,
        IReadOnlyList<ObservedLifecycleEvent> actualEvents)
    {
        JsonElement.ArrayEnumerator expected = expectedEvents.EnumerateArray();
        Assert.Equal(expected.Count(), actualEvents.Count);
        int index = 0;
        foreach (JsonElement item in expected)
        {
            ObservedLifecycleEvent actual = actualEvents[index];
            string type = item.GetProperty("type").GetString()!;
            Assert.Equal(type, actual.Type);
            if (type == "state-changed")
            {
                Assert.Equal(ReadState(item.GetProperty("state")), actual.State);
            }
            else if (type == "value-changed")
            {
                Assert.Equal(item.GetProperty("name").GetString(), actual.Name);
                Assert.Equal(
                    ReadTaggedValue(item.GetProperty("previousValue")),
                    actual.PreviousValue);
                Assert.Equal(ReadTaggedValue(item.GetProperty("value")), actual.Value);
            }
            else
            {
                KajayValue expectedData = ReadJsonValue(item.GetProperty("data"));
                KajayValue actualData = KajayValue.FromObject(actual.Data!);
                Assert.Equal(expectedData, actualData);
            }

            index += 1;
        }
    }

    private static KajayValue ReadTaggedValue(JsonElement value)
    {
        return value.GetProperty("kind").GetString() switch
        {
            "undefined" => KajayValue.Absent,
            "json" => ReadJsonValue(value.GetProperty("value")),
            "date" => KajayValue.From(DateTimeOffset.Parse(
                value.GetProperty("value").GetString()!,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind)),
            _ => throw new InvalidOperationException("Unknown tagged value kind."),
        };
    }

    private static KajayValue ReadJsonValue(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.Null => KajayValue.Null,
            JsonValueKind.True => KajayValue.From(true),
            JsonValueKind.False => KajayValue.From(false),
            JsonValueKind.Number => KajayValue.From(value.GetDouble()),
            JsonValueKind.String => KajayValue.From(value.GetString()!),
            JsonValueKind.Array => KajayValue.FromArray(
                value.EnumerateArray().Select(ReadJsonValue)),
            JsonValueKind.Object => KajayValue.FromObject(
                value.EnumerateObject().Select(property =>
                    new KeyValuePair<string, KajayValue>(
                        property.Name,
                        ReadJsonValue(property.Value)))),
            _ => throw new InvalidOperationException("Unsupported JSON value kind."),
        };
    }

    private static SurveyState ReadState(JsonElement state)
    {
        return Enum.Parse<SurveyState>(state.GetString()!, ignoreCase: true);
    }

    private static JsonElement FindScenario(JsonDocument corpus, string scenarioId)
    {
        return corpus.RootElement
            .GetProperty("scenarios")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == scenarioId);
    }

    private static JsonDocument OpenLifecycleCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v1",
            "lifecycle.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }

    private sealed record ObservedLifecycleEvent(
        string Type,
        SurveyState? State = null,
        string? Name = null,
        KajayValue PreviousValue = default,
        KajayValue Value = default,
        IReadOnlyDictionary<string, KajayValue>? Data = null)
    {
        public static ObservedLifecycleEvent StateChanged(SurveyState state)
        {
            return new ObservedLifecycleEvent("state-changed", State: state);
        }

        public static ObservedLifecycleEvent ValueChanged(
            string name,
            KajayValue previousValue,
            KajayValue value)
        {
            return new ObservedLifecycleEvent(
                "value-changed",
                Name: name,
                PreviousValue: previousValue,
                Value: value);
        }

        public static ObservedLifecycleEvent Completed(
            IReadOnlyDictionary<string, KajayValue> data)
        {
            return new ObservedLifecycleEvent("complete", Data: data);
        }
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;

        public override DateTimeOffset GetUtcNow()
        {
            return _now;
        }

        public void Advance(TimeSpan duration)
        {
            _now += duration;
        }
    }
}
