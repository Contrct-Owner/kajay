namespace Kajay.Core.Tests;

public sealed class SurveyCalculatedValueTests
{
    [Fact]
    public void CalculatedValuesSettleInDependencyOrderAndJoinSubmittedData()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "calculatedValues": [
                {
                  "name": "subtotal",
                  "expression": "{price} * 2"
                },
                {
                  "name": "total",
                  "expression": "{subtotal} + 5",
                  "includeIntoResult": true
                }
              ],
              "pages": [{"name":"checkout"}]
            }
            """)
            .Definition
            .CreateSurvey();
        List<(string Name, KajayValue Previous, KajayValue Value)> events = [];
        survey.ValueChanged += (_, change) => events.Add(
            (change.Name, change.PreviousValue, change.Value));

        Assert.True(survey.TryGetCalculatedValue("subtotal", out KajayValue subtotal));
        Assert.Equal(KajayValue.Absent, subtotal);
        Assert.True(survey.TryGetValue("total", out KajayValue initialTotal));
        Assert.Equal(KajayValue.Absent, initialTotal);
        Assert.False(survey.Data.ContainsKey("subtotal"));
        Assert.Equal(KajayValue.Absent, survey.Data["total"]);

        survey.SetValue("price", KajayValue.From(20));

        Assert.Equal(KajayValue.From(40), AssertCalculated(survey, "subtotal"));
        Assert.Equal(KajayValue.From(45), AssertCalculated(survey, "total"));
        Assert.Equal(
            [
                ("price", KajayValue.Absent, KajayValue.From(20)),
                ("total", KajayValue.Absent, KajayValue.From(45)),
            ],
            events);

        SurveyCompletedEventArgs? completed = null;
        survey.Completed += (_, args) => completed = args;
        survey.Complete();

        Assert.NotNull(completed);
        Assert.Equal(KajayValue.From(20), completed.Data["price"]);
        Assert.Equal(KajayValue.From(45), completed.Data["total"]);
        Assert.False(completed.Data.ContainsKey("subtotal"));
    }

    [Fact]
    public void SurveyLogicUsesTheExplicitClockAndHostFunctionRegistry()
    {
        var clock = new FixedTimeProvider(
            new DateTimeOffset(2026, 8, 5, 12, 34, 56, TimeSpan.Zero));
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.Add(
            "twice",
            static (arguments, _) => KajayValue.From(arguments[0].GetNumber() * 2));
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "calculatedValues": [
                {"name":"answer","expression":"twice(21)"},
                {"name":"day","expression":"currentDate()"}
              ],
              "pages": [{"name":"one"}]
            }
            """)
            .Definition
            .CreateSurvey(new SurveyOptions
            {
                TimeProvider = clock,
                ExpressionFunctions = functions,
            });

        Assert.Equal(KajayValue.From(42), AssertCalculated(survey, "answer"));
        Assert.Equal(
            KajayValue.From(new DateTimeOffset(2026, 8, 5, 12, 34, 56, TimeSpan.Zero)),
            AssertCalculated(survey, "day"));
    }

    [Fact]
    public void ACalculatedValueCycleDoesNotSuppressAnIndependentRule()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "calculatedValues": [
                {"name":"a","expression":"{b} + 1"},
                {"name":"b","expression":"{a} + 1"},
                {"name":"independent","expression":"40 + 2"}
              ],
              "pages": [{"name":"one"}]
            }
            """)
            .Definition
            .CreateSurvey();

        Assert.False(survey.TryGetCalculatedValue("a", out _));
        Assert.False(survey.TryGetCalculatedValue("b", out _));
        Assert.Equal(KajayValue.From(42), AssertCalculated(survey, "independent"));
    }

    private static KajayValue AssertCalculated(Survey survey, string name)
    {
        Assert.True(survey.TryGetCalculatedValue(name, out KajayValue value));
        return value;
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
