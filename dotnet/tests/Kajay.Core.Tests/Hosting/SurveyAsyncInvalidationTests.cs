namespace Kajay.Core.Tests;

public sealed class SurveyAsyncInvalidationTests
{
    [Fact]
    public async Task ARecordedResultIsAskedForAgainAfterInvalidation()
    {
        List<string> asked = [];
        double price = 50;
        Survey survey = CreateSurvey(asked, () => price);
        survey.SetValue("sku", KajayValue.From("widget"));
        await survey.SettleAsync();
        Assert.Equal(["widget"], asked);
        Assert.False(QuestionState(survey, "offer").IsVisible);

        price = 500;
        await survey.InvalidateAsyncResultsAsync();

        // Recorded results are permanent by design, which is right until the world they
        // describe moves. Without this there is no way to say it has.
        Assert.Equal(["widget", "widget"], asked);
        Assert.True(QuestionState(survey, "offer").IsVisible);
    }

    [Fact]
    public async Task AFailureIsRetried()
    {
        List<string> asked = [];
        bool failing = true;
        Survey survey = CreateSurvey(
            asked,
            () => failing ? throw new InvalidOperationException("down") : 500);
        survey.SetValue("sku", KajayValue.From("widget"));
        await survey.SettleAsync();
        Assert.Equal(["widget"], asked);

        failing = false;
        await survey.InvalidateAsyncResultsAsync();

        // A rejected call is recorded and never retried on its own, so a lookup that failed
        // once stays failed for the life of the survey. This is the only way back.
        //
        // Proven by the second call and the value it produced, deliberately not by the
        // visibility while the call was failing: how a *broken* condition resolves differs
        // between the runtimes today, and that difference is older than this seam.
        Assert.Equal(["widget", "widget"], asked);
        Assert.True(QuestionState(survey, "offer").IsVisible);
    }

    [Fact]
    public async Task NothingIsAskedAgainWhileTheAnswerHasNotMoved()
    {
        List<string> asked = [];
        Survey survey = CreateSurvey(asked, () => 50);
        survey.SetValue("sku", KajayValue.From("widget"));
        await survey.SettleAsync();

        await survey.SettleAsync();

        // The record still does its real job: without it each settle restarts the call.
        Assert.Equal(["widget"], asked);
    }

    [Fact]
    public async Task NamingAFunctionDiscardsOnlyThatFunction()
    {
        List<string> asked = [];
        List<string> stockAsked = [];
        ExpressionFunctionRegistry functions = Quoting(asked, () => 50)
            .AddAsync("stock", (arguments, _, _) =>
            {
                string sku = arguments[0].Kind == KajayValueKind.Text
                    ? arguments[0].GetString()
                    : string.Empty;
                if (sku.Length > 0)
                {
                    stockAsked.Add(sku);
                }

                return ValueTask.FromResult(KajayValue.From(1d));
            });
        Survey survey = CreateSurvey(functions, """
            {
              "pages":[
                {
                  "name":"p1",
                  "elements":[
                    {"type":"text","name":"sku"},
                    {"type":"text","name":"offer","visibleIf":"quote({sku}) > 100"},
                    {"type":"text","name":"inStock","visibleIf":"stock({sku}) > 0"}
                  ]
                }
              ]
            }
            """);
        survey.SetValue("sku", KajayValue.From("widget"));
        await survey.SettleAsync();
        Assert.Single(asked);
        Assert.Single(stockAsked);

        await survey.InvalidateAsyncResultsAsync("quote");

        // A host that knows its quote service moved should not have to discard an
        // eligibility check that did not.
        Assert.Equal(["widget", "widget"], asked);
        Assert.Equal(["widget"], stockAsked);
    }

    private static ExpressionFunctionRegistry Quoting(List<string> asked, Func<double> answer)
    {
        return ExpressionFunctionRegistry.Empty.AddAsync("quote", (arguments, _, _) =>
        {
            string sku = arguments[0].Kind == KajayValueKind.Text
                ? arguments[0].GetString()
                : string.Empty;
            if (sku.Length == 0)
            {
                // Every asynchronous function is reached once with whatever arguments exist
                // then, and a lookup that costs something should not pay for that call.
                return ValueTask.FromResult(KajayValue.Absent);
            }

            asked.Add(sku);
            return ValueTask.FromResult(KajayValue.From(answer()));
        });
    }

    private static Survey CreateSurvey(List<string> asked, Func<double> answer)
    {
        return CreateSurvey(Quoting(asked, answer));
    }

    private static Survey CreateSurvey(ExpressionFunctionRegistry functions)
    {
        return CreateSurvey(functions, """
            {
              "pages":[
                {
                  "name":"p1",
                  "elements":[
                    {"type":"text","name":"sku"},
                    {"type":"text","name":"offer","visibleIf":"quote({sku}) > 100"}
                  ]
                }
              ]
            }
            """);
    }

    private static Survey CreateSurvey(ExpressionFunctionRegistry functions, string definition)
    {
        return SurveyDefinition.Parse(definition)
            .Definition
            .CreateSurvey(new SurveyOptions { ExpressionFunctions = functions });
    }

    private static SurveyQuestionState QuestionState(Survey survey, string name)
    {
        Assert.True(survey.TryGetQuestionState(name, out SurveyQuestionState state));
        return state;
    }
}
