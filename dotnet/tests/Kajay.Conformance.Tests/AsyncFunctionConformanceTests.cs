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

    [Fact]
    public void PendingAsyncFunctionsProduceTheAbsentValueWithoutAnError()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(
            corpus,
            "async-function-is-absent-while-pending");
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            testCase.GetProperty("asyncFunction").GetProperty("name").GetString()!,
            static (_, _, _) => ValueTask.FromResult(KajayValue.Null));
        ExpressionEvaluationContext context = new(
            ReadClock(corpus),
            Array.Empty<KeyValuePair<string, KajayValue>>(),
            functions,
            new FixedAsyncFunctionValueSource(AsyncFunctionValue.Pending));

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(context);

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValue.Absent, evaluated.Value);
    }

    [Fact]
    public void ResolvedAsyncFunctionsReadTheSettledValue()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(
            corpus,
            "async-function-reads-a-settled-value");
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            testCase.GetProperty("asyncFunction").GetProperty("name").GetString()!,
            static (_, _, _) => ValueTask.FromResult(KajayValue.Null));
        KajayValue settledValue = KajayValue.From(
            testCase.GetProperty("result").GetProperty("value").GetDouble());
        ExpressionEvaluationContext context = new(
            ReadClock(corpus),
            Array.Empty<KeyValuePair<string, KajayValue>>(),
            functions,
            new FixedAsyncFunctionValueSource(
                AsyncFunctionValue.Resolved(settledValue)));

        ExpressionParseResult parsed = SurveyExpression.Parse(
            testCase.GetProperty("source").GetString()!);
        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(context);

        Assert.Empty(parsed.Errors);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(settledValue, evaluated.Value);
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

    private sealed class FixedAsyncFunctionValueSource(AsyncFunctionValue value)
        : IAsyncFunctionValueSource
    {
        public AsyncFunctionValue GetValue(
            string name,
            IReadOnlyList<KajayValue> arguments)
        {
            return value;
        }
    }
}
