using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class ExpressionV2ConformanceTests
{
    [Fact]
    public void DecimalTextWithAnExponentIsNumeric()
    {
        AssertNumericTextCase("decimal-text-with-exponent-is-numeric");
    }

    [Fact]
    public void LeadingDecimalPointIsNumeric()
    {
        AssertNumericTextCase("leading-decimal-point-is-numeric");
    }

    [Fact]
    public void ContractWhitespaceIsTrimmedFromNumericText()
    {
        AssertNumericTextCase("contract-whitespace-is-trimmed-from-numeric-text");
    }

    [Fact]
    public void HexadecimalTextIsNotNumeric()
    {
        AssertEvaluationCase("hexadecimal-text-is-not-numeric");
    }

    private static void AssertNumericTextCase(string caseId)
    {
        ExpressionEvaluationResult evaluated = EvaluateCase(caseId, out JsonDocument corpus);
        using (corpus)
        {
            JsonElement testCase = FindCase(corpus, caseId);
            Assert.Empty(evaluated.Errors);
            Assert.Equal(KajayValueKind.Number, evaluated.Value.Kind);
            Assert.Equal(
                testCase.GetProperty("result").GetProperty("value").GetDouble(),
                evaluated.Value.GetNumber());
        }
    }

    private static void AssertEvaluationCase(string caseId)
    {
        ExpressionEvaluationResult evaluated = EvaluateCase(caseId, out JsonDocument corpus);
        using (corpus)
        {
            JsonElement expected = FindCase(corpus, caseId).GetProperty("result");
            Assert.Empty(evaluated.Errors);
            Assert.Equal(expected.GetProperty("value").GetBoolean(), evaluated.Value.GetBoolean());
        }
    }

    private static ExpressionEvaluationResult EvaluateCase(
        string caseId,
        out JsonDocument corpus)
    {
        corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(corpus, caseId);
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);
        var values = new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["amount"] = KajayValue.From(
                testCase.GetProperty("data").GetProperty("amount").GetString()!),
        };

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(clock, values));

        Assert.Empty(parsed.Errors);
        return evaluated;
    }

    private static JsonElement FindCase(JsonDocument corpus, string caseId)
    {
        return corpus.RootElement
            .GetProperty("evaluation")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == caseId);
    }

    private static JsonDocument OpenExpressionCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v2",
            "expressions.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }
}
