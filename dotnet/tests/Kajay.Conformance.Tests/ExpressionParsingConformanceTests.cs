using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class ExpressionParsingConformanceTests
{
    [Fact]
    public void AlternativeOperatorsCanonicalizeThroughThePublicExpressionSeam()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("parsing")
            .EnumerateArray()
            .Single(candidate =>
                candidate.GetProperty("id").GetString() == "alternative-operators-canonicalize");

        ExpressionParseResult result = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);

        Assert.Empty(result.Errors);
        Assert.NotNull(result.Expression);
        Assert.Equal(
            testCase.GetProperty("canonical").GetString(),
            result.Expression.ToCanonicalString());
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
