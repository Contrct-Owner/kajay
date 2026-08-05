using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class ExpressionEvaluationConformanceTests
{
    [Fact]
    public void ArithmeticPrecedenceEvaluatesThroughThePublicExpressionSeam()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate =>
                candidate.GetProperty("id").GetString() == "arithmetic-precedence");
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(clock));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Number, evaluated.Value.Kind);
        Assert.Equal(
            testCase.GetProperty("result").GetProperty("value").GetDouble(),
            evaluated.Value.GetNumber());
    }

    [Fact]
    public void NumericStringReferencesCoerceThroughThePublicExpressionSeam()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate =>
                candidate.GetProperty("id").GetString() == "numeric-string-coercion");
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);
        string amount = testCase
            .GetProperty("data")
            .GetProperty("amount")
            .GetString()!;

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(
                clock,
                new Dictionary<string, KajayValue>
                {
                    ["amount"] = KajayValue.From(amount),
                }));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Number, evaluated.Value.Kind);
        Assert.Equal(
            testCase.GetProperty("result").GetProperty("value").GetDouble(),
            evaluated.Value.GetNumber());
    }

    [Fact]
    public void DivisionByZeroProducesTheDistinctAbsentValue()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate =>
                candidate.GetProperty("id").GetString() == "division-by-zero-is-undefined");
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(clock));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Absent, evaluated.Value.Kind);
        Assert.Equal(KajayValue.Absent, evaluated.Value);
    }

    [Fact]
    public void MissingReferencesCompareEqualToNull()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate =>
                candidate.GetProperty("id").GetString() == "missing-is-equal-to-null");
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(clock));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Boolean, evaluated.Value.Kind);
        Assert.True(evaluated.Value.GetBoolean());
        Assert.NotEqual(KajayValue.Absent, KajayValue.Null);
    }

    [Fact]
    public void EmptyArraysSatisfyTheEmptyPostfixOperator()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate =>
                candidate.GetProperty("id").GetString() == "empty-array-is-empty");
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(
                clock,
                new Dictionary<string, KajayValue>
                {
                    ["values"] = KajayValue.FromArray([]),
                }));

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValueKind.Boolean, evaluated.Value.Kind);
        Assert.True(evaluated.Value.GetBoolean());
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
