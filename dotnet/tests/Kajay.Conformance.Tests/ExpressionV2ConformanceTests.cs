using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class ExpressionV2ConformanceTests
{
    [Fact]
    public void DecimalTextWithAnExponentIsNumeric()
    {
        AssertEvaluationCase("decimal-text-with-exponent-is-numeric");
    }

    [Fact]
    public void LeadingDecimalPointIsNumeric()
    {
        AssertEvaluationCase("leading-decimal-point-is-numeric");
    }

    [Fact]
    public void ContractWhitespaceIsTrimmedFromNumericText()
    {
        AssertEvaluationCase("contract-whitespace-is-trimmed-from-numeric-text");
    }

    [Fact]
    public void HexadecimalTextIsNotNumeric()
    {
        AssertEvaluationCase("hexadecimal-text-is-not-numeric");
    }

    [Fact]
    public void BooleanIsNotNumeric()
    {
        AssertEvaluationCase("boolean-is-not-numeric");
    }

    [Fact]
    public void BooleanArithmeticIsAbsent()
    {
        AssertEvaluationCase("boolean-arithmetic-is-absent");
    }

    [Fact]
    public void NonFiniteArithmeticIsAbsent()
    {
        AssertEvaluationCase("non-finite-arithmetic-is-absent");
    }

    [Fact]
    public void BooleanTextIsNotABoolean()
    {
        AssertEvaluationCase("boolean-text-is-not-a-boolean");
    }

    [Fact]
    public void EmptyArrayIsFalse()
    {
        AssertEvaluationCase("empty-array-is-false");
    }

    [Fact]
    public void EmptyObjectIsTrue()
    {
        AssertEvaluationCase("empty-object-is-true");
    }

    [Fact]
    public void NumericZeroIsFalse()
    {
        AssertEvaluationCase("numeric-zero-is-false");
    }

    private static void AssertEvaluationCase(string caseId)
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(corpus, caseId);
        DateTimeOffset clock = DateTimeOffset.Parse(
            corpus.RootElement.GetProperty("clock").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind);
        IReadOnlyDictionary<string, KajayValue> values =
            testCase.TryGetProperty("data", out JsonElement data)
                ? ConformanceJsonValue.ReadObject(data)
                : new Dictionary<string, KajayValue>(StringComparer.Ordinal);

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(clock, values));

        Assert.Empty(parsed.Errors);
        Assert.Equal(
            testCase.GetProperty("errorCodes").EnumerateArray().Select(item => item.GetString()),
            evaluated.Errors.Select(error => error.Code));
        Assert.Equal(
            ConformanceJsonValue.ReadTagged(testCase.GetProperty("result")),
            evaluated.Value);
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
