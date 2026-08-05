using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class ExpressionParsingConformanceTests
{
    [Fact]
    public void AlternativeOperatorsCanonicalizeThroughThePublicExpressionSeam()
    {
        AssertParsingCase("alternative-operators-canonicalize");
    }

    [Fact]
    public void UnterminatedStringsProduceAStableParseError()
    {
        AssertParsingCase("unterminated-string");
    }

    [Fact]
    public void UnknownBareIdentifiersProduceAStableParseError()
    {
        AssertParsingCase("unknown-identifier");
    }

    private static void AssertParsingCase(string id)
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("parsing")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == id);

        ExpressionParseResult result = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);

        JsonElement expectedCanonical = testCase.GetProperty("canonical");
        Assert.Equal(
            expectedCanonical.ValueKind == JsonValueKind.Null
                ? null
                : expectedCanonical.GetString(),
            result.Expression?.ToCanonicalString());
        Assert.Equal(
            testCase.GetProperty("errorCodes").EnumerateArray().Select(code => code.GetString()),
            result.Errors.Select(error => error.Code));
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
