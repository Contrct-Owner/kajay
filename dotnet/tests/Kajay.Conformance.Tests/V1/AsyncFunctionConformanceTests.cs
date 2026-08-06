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
    public async Task PendingAsyncFunctionsProduceTheAbsentValueWithoutAnError()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(
            corpus,
            "async-function-is-absent-while-pending");
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            testCase.GetProperty("asyncFunction").GetProperty("name").GetString()!,
            async (_, _, cancellationToken) =>
            {
                started.SetResult();
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
                return KajayValue.Null;
            });
        Survey survey = CreateSurvey(testCase, functions, ReadClock(corpus));
        using var cancellation = new CancellationTokenSource();

        Task pending = survey.SettleAsync(cancellation.Token);
        await started.Task;

        Assert.True(survey.TryGetCalculatedValue("result", out KajayValue pendingValue));
        Assert.Equal(KajayValue.Absent, pendingValue);
        Assert.Empty(survey.LogicErrors);
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
    }

    [Fact]
    public async Task ResolvedAsyncFunctionsReadTheSettledValue()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(
            corpus,
            "async-function-reads-a-settled-value");
        KajayValue settledValue = KajayValue.From(
            testCase.GetProperty("result").GetProperty("value").GetDouble());
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            testCase.GetProperty("asyncFunction").GetProperty("name").GetString()!,
            (_, _, _) => ValueTask.FromResult(settledValue));
        Survey survey = CreateSurvey(testCase, functions, ReadClock(corpus));

        await survey.SettleAsync();

        Assert.True(survey.TryGetCalculatedValue("result", out KajayValue value));
        Assert.Equal(settledValue, value);
        Assert.Empty(survey.LogicErrors);
    }

    [Fact]
    public async Task FailedAsyncFunctionsReportTheFailureAtTheCallSite()
    {
        using JsonDocument corpus = OpenExpressionCorpus();
        JsonElement testCase = FindCase(corpus, "async-function-failure-is-reported");
        JsonElement outcome = testCase
            .GetProperty("asyncFunction")
            .GetProperty("outcome");
        string failure = outcome.GetProperty("message").GetString()!;
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            testCase.GetProperty("asyncFunction").GetProperty("name").GetString()!,
            (_, _, _) => throw new InvalidOperationException(failure));
        Survey survey = CreateSurvey(testCase, functions, ReadClock(corpus));

        await survey.SettleAsync();

        Assert.True(survey.TryGetCalculatedValue("result", out KajayValue failedValue));
        Assert.Equal(KajayValue.Absent, failedValue);
        ExpressionError error = Assert.Single(survey.LogicErrors);
        Assert.Equal(
            testCase.GetProperty("errorCodes")[0].GetString(),
            error.Code);
        Assert.Equal(failure, error.Message);
        Assert.Equal(
            new TextSpan(0, testCase.GetProperty("source").GetString()!.Length),
            error.Span);
    }

    private static Survey CreateSurvey(
        JsonElement testCase,
        ExpressionFunctionRegistry functions,
        DateTimeOffset clock)
    {
        string source = JsonSerializer.Serialize(
            testCase.GetProperty("source").GetString()!);
        string definition = $$"""
            {
              "calculatedValues":[
                {"name":"result","expression":{{source}},"includeIntoResult":true}
              ],
              "pages":[{"name":"only"}]
            }
            """;
        return SurveyDefinition.Parse(definition).Definition.CreateSurvey(new SurveyOptions
        {
            ExpressionFunctions = functions,
            TimeProvider = new FixedTimeProvider(clock),
        });
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

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
