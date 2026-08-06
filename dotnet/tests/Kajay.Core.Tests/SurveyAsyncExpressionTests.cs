namespace Kajay.Core.Tests;

public sealed class SurveyAsyncExpressionTests
{
    [Fact]
    public async Task SettlementCachesAsyncResultsAndReappliesSurveyLogic()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2030, 2, 3, 4, 5, 6, TimeSpan.Zero));
        var calls = new List<(KajayValue Argument, DateTimeOffset Clock)>();
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            "lookup",
            (arguments, context, _) =>
            {
                calls.Add((arguments[0], context.Clock));
                KajayValue result = arguments[0] == KajayValue.From(21)
                    ? KajayValue.From("allowed")
                    : KajayValue.Absent;
                return ValueTask.FromResult(result);
            });
        Survey survey = CreateSurvey(functions, clock);

        await survey.SettleAsync();
        await survey.SetValueAsync("id", KajayValue.From(21));

        Assert.Equal(KajayValue.From("allowed"), survey.Data["status"]);
        Assert.True(survey.IsPageVisible("branch"));
        Assert.Equal(
            [(KajayValue.Absent, clock.GetUtcNow()), (KajayValue.From(21), clock.GetUtcNow())],
            calls);
        await survey.SettleAsync();
        Assert.Equal(2, calls.Count);
        Assert.False(survey.IsSettling);
    }

    [Fact]
    public async Task CancellationStopsSettlementAndAllowsTheCallToBeRetried()
    {
        int calls = 0;
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            "lookup",
            async (_, _, cancellationToken) =>
            {
                calls += 1;
                await release.Task.WaitAsync(cancellationToken);
                return KajayValue.From("done");
            });
        Survey survey = CreateSurvey(functions, TimeProvider.System);
        survey.SetValue("id", KajayValue.From(1));
        using var cancellation = new CancellationTokenSource();

        Task pending = survey.SettleAsync(cancellation.Token);
        Assert.True(survey.IsSettling);
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.False(survey.IsSettling);
        release.SetResult();
        await survey.SettleAsync();
        Assert.Equal(2, calls);
        Assert.Equal(KajayValue.From("done"), survey.Data["status"]);
    }

    private static Survey CreateSurvey(
        ExpressionFunctionRegistry functions,
        TimeProvider timeProvider)
    {
        return SurveyDefinition.Parse(
            """
            {
              "calculatedValues":[{"name":"status","expression":"lookup({id})","includeIntoResult":true}],
              "pages":[
                {"name":"start"},
                {"name":"branch","visibleIf":"lookup({id}) = 'allowed'"}
              ]
            }
            """)
            .Definition
            .CreateSurvey(new SurveyOptions
            {
                ExpressionFunctions = functions,
                TimeProvider = timeProvider,
            });
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
