using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class SurveyV2ConformanceTests
{
    [Fact]
    public void HostValuesResolveIncludingDescentIntoStructuredValues()
    {
        AssertScenario("host-values-resolve-including-descent-into-structured-values");
    }

    [Fact]
    public void AHostValueWriteRecomputesWithoutBeingAnAnswerChange()
    {
        AssertScenario("a-host-value-write-recomputes-without-being-an-answer-change");
    }

    [Fact]
    public void TheHostScopeAndTheAnswerScopeAreIndependent()
    {
        AssertScenario("the-host-scope-and-the-answer-scope-are-independent");
    }

    [Fact]
    public void PortablePatternMatchesAndRejects()
    {
        AssertScenario("portable-pattern-matches-and-rejects");
    }

    [Fact]
    public void PatternSearchesUnlessAnchored()
    {
        AssertScenario("pattern-searches-unless-anchored");
    }

    [Fact]
    public void PatternClassesAndDotUseDefinedScalars()
    {
        AssertScenario("pattern-classes-and-dot-use-defined-scalars");
    }

    [Fact]
    public void InvalidPatternIsAnAuthorErrorNotARespondentRule()
    {
        AssertScenario("invalid-pattern-is-an-author-error-not-a-respondent-rule");
    }

    [Fact]
    public void AMultiSelectIsScoredChoiceByChoice()
    {
        AssertScenario("a-multi-select-is-scored-choice-by-choice");
    }

    [Fact]
    public void SurveyScenarioObservesQuizScore()
    {
        AssertScenario("survey-scenario-observes-quiz-score");
    }

    private static void AssertScenario(string scenarioId)
    {
        using JsonDocument corpus = OpenScenarioCorpus();
        JsonElement scenario = corpus.RootElement
            .GetProperty("scenarios")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == scenarioId);
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(
            scenario.GetProperty("definition").GetRawText());
        Survey survey = parsed.Definition.CreateSurvey(new SurveyOptions
        {
            HostValues = ReadHostValues(scenario),
        });
        var events = new List<ObservedValueChange>();
        survey.ValueChanged += (_, args) => events.Add(
            new ObservedValueChange(args.Name, args.PreviousValue, args.Value));

        JsonElement expectedInitial = scenario.GetProperty("expectInitial");
        Assert.Equal(ReadState(expectedInitial.GetProperty("state")), survey.State);
        AssertDiagnostics(expectedInitial.GetProperty("diagnostics"), parsed.Diagnostics);

        foreach (JsonElement step in scenario.GetProperty("steps").EnumerateArray())
        {
            events.Clear();
            object? observation = ApplyAction(
                survey,
                step.GetProperty("action"));

            JsonElement expected = step.GetProperty("expect");
            Assert.Equal(ReadState(expected.GetProperty("state")), survey.State);
            AssertEvents(expected.GetProperty("events"), events);
            if (expected.TryGetProperty("observation", out JsonElement expectedObservation))
            {
                AssertObservation(expectedObservation, observation!);
            }
            else
            {
                Assert.Null(observation);
            }
        }
    }

    private static object? ApplyAction(
        Survey survey,
        JsonElement action)
    {
        return action.GetProperty("kind").GetString() switch
        {
            "set-value" => SetValue(survey, action),
            "set-host-value" => SetHostValue(survey, action),
            "validate-current-page" => survey.Validation.ValidateCurrentPage(),
            "measure-score" => survey.GetQuizScore(),
            _ => throw new InvalidOperationException("Unknown survey action."),
        };
    }

    private static object? SetValue(
        Survey survey,
        JsonElement action)
    {
        survey.SetValue(
            action.GetProperty("name").GetString()!,
            ReadJsonValue(action.GetProperty("value")));
        return null;
    }

    private static object? SetHostValue(
        Survey survey,
        JsonElement action)
    {
        survey.SetHostValue(
            action.GetProperty("name").GetString()!,
            ReadJsonValue(action.GetProperty("value")));
        return null;
    }

    private static Dictionary<string, KajayValue> ReadHostValues(JsonElement scenario)
    {
        var values = new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        if (scenario.TryGetProperty("hostValues", out JsonElement hostValues))
        {
            foreach (JsonProperty property in hostValues.EnumerateObject())
            {
                values[property.Name] = ReadJsonValue(property.Value);
            }
        }

        return values;
    }

    private static void AssertDiagnostics(
        JsonElement expected,
        IReadOnlyList<DefinitionDiagnostic> actual)
    {
        Assert.Equal(
            expected.EnumerateArray().Select(item => (
                item.GetProperty("code").GetString(),
                item.GetProperty("path").GetString(),
                Enum.Parse<DiagnosticSeverity>(
                    item.GetProperty("severity").GetString()!,
                    ignoreCase: true))),
            actual.Select(item => ((string?)item.Code, (string?)item.Path, item.Severity)));
    }

    private static void AssertEvents(
        JsonElement expected,
        IReadOnlyList<ObservedValueChange> actual)
    {
        JsonElement.ArrayEnumerator expectedEvents = expected.EnumerateArray();
        Assert.Equal(expectedEvents.Count(), actual.Count);
        int index = 0;
        foreach (JsonElement item in expectedEvents)
        {
            Assert.Equal("value-changed", item.GetProperty("type").GetString());
            Assert.Equal(item.GetProperty("name").GetString(), actual[index].Name);
            Assert.Equal(
                ReadTaggedValue(item.GetProperty("previousValue")),
                actual[index].PreviousValue);
            Assert.Equal(ReadTaggedValue(item.GetProperty("value")), actual[index].Value);
            index += 1;
        }
    }

    private static void AssertObservation(JsonElement expected, object actual)
    {
        if (expected.GetProperty("kind").GetString() == "validation")
        {
            AssertValidation(expected, Assert.IsType<SurveyValidationResult>(actual));
            return;
        }

        AssertScore(expected, Assert.IsType<QuizScore>(actual));
    }

    private static void AssertValidation(
        JsonElement expected,
        SurveyValidationResult actual)
    {
        Assert.Equal("validation", expected.GetProperty("kind").GetString());
        Assert.Equal(expected.GetProperty("isValid").GetBoolean(), actual.IsValid);
        Assert.Equal(
            expected.GetProperty("errors").EnumerateArray().Select(error => (
                error.GetProperty("name").GetString(),
                error.GetProperty("kind").GetString())),
            actual.Errors.Select(error => ((string?)error.Name, (string?)error.Kind)));
    }

    private static void AssertScore(JsonElement expected, QuizScore actual)
    {
        Assert.Equal("score", expected.GetProperty("kind").GetString());
        Assert.Equal(expected.GetProperty("earned").GetDouble(), actual.Earned);
        Assert.Equal(expected.GetProperty("possible").GetDouble(), actual.Possible);
        Assert.Equal(expected.GetProperty("questionCount").GetInt32(), actual.QuestionCount);
        Assert.Equal(expected.GetProperty("ratio").GetDouble(), actual.Ratio);
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

    private static JsonDocument OpenScenarioCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v2",
            "scenarios.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }

    private sealed record ObservedValueChange(
        string Name,
        KajayValue PreviousValue,
        KajayValue Value);
}
