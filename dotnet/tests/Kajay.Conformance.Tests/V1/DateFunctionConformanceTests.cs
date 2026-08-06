using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class DateFunctionConformanceTests
{
    [Theory]
    [InlineData("today-is-midnight-utc")]
    [InlineData("current-date-uses-the-explicit-clock")]
    public void ClockFunctionsUseTheExplicitUtcClock(string caseId)
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(corpus, caseId);
        DateTimeOffset clock = ReadClock(corpus);
        DateTimeOffset expected = DateTimeOffset.Parse(
            testCase.GetProperty("result").GetProperty("value").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(clock));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Instant, evaluated.Value.Kind);
        Assert.Equal(expected, evaluated.Value.GetInstant());
    }

    [Fact]
    public void DateDifferenceUsesUtcCalendarDays()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(corpus, "date-difference-uses-utc-days");

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(ReadClock(corpus)));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Number, evaluated.Value.Kind);
        Assert.Equal(
            testCase.GetProperty("result").GetProperty("value").GetDouble(),
            evaluated.Value.GetNumber());
    }

    [Fact]
    public void DateDifferenceNormalizesOffsetsBeforeSelectingUtcDays()
    {
        ExpressionParseResult parsed = SurveyExpression.Parse(
            "diffDays('2026-08-02T23:30:00-05:00', '2026-08-03T00:00:00Z')");
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(DateTimeOffset.UnixEpoch));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Number, evaluated.Value.Kind);
        Assert.Equal(0, evaluated.Value.GetNumber());
    }

    [Theory]
    [InlineData("2026-08-02T12:34:56")]
    [InlineData("2026-02-30")]
    [InlineData("2026-08-02T12:34:56.1234Z")]
    public void DateDifferenceRejectsNonContractDateText(string invalidDate)
    {
        ExpressionParseResult parsed = SurveyExpression.Parse(
            $"diffDays('{invalidDate}', '2026-08-03')");
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(DateTimeOffset.UnixEpoch));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValue.Absent, evaluated.Value);
    }

    private static JsonElement FindCase(JsonDocument corpus, string caseId)
    {
        return corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == caseId);
    }

    private static DateTimeOffset ReadClock(JsonDocument corpus)
    {
        return DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);
    }

    private static JsonDocument OpenExpressionCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v1",
            "expressions.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }
}
