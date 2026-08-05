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
