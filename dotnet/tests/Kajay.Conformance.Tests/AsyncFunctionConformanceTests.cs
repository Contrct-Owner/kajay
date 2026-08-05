using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class AsyncFunctionConformanceTests
{
    [Fact]
    public void AsyncFunctionsNeedASurveyOwnedValueSource()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(corpus, "async-function-needs-a-value-source");
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            testCase.GetProperty("asyncFunction").GetProperty("name").GetString()!,
            static (_, _, _) => ValueTask.FromResult(KajayValue.Null));

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(
            new ExpressionEvaluationContext(ReadClock(corpus), functions));

        Assert.Empty(parsed.Errors);
        Assert.Equal(KajayValue.Absent, evaluated.Value);
        Assert.Equal(
            testCase.GetProperty("errorCodes")
                .EnumerateArray()
                .Select(code => code.GetString()),
            evaluated.Errors.Select(error => error.Code));
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
