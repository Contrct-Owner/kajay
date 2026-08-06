namespace Kajay.Core.Tests;

public sealed class SurveyTriggerTests
{
    [Fact]
    public void EveryTriggerKindActsOnlyOnTheTransitionIntoTrue()
    {
        Survey survey = CreateSurvey();
        List<string> valueChanges = [];
        survey.ValueChanged += (sender, change) =>
        {
            _ = sender;
            Assert.True(survey.TryGetCalculatedValue("doubled", out _));
            valueChanges.Add(change.Name);
        };

        survey.SetValue("source", KajayValue.From(1));
        Assert.Equal(KajayValue.From("literal"), Value(survey, "setTarget"));
        survey.SetValue("setTarget", KajayValue.From("respondent edit"));
        Assert.Equal(KajayValue.From("respondent edit"), Value(survey, "setTarget"));

        survey.SetValue("source", KajayValue.From(2));
        Assert.Equal(KajayValue.From(2), Value(survey, "copyTarget"));

        survey.SetValue("source", KajayValue.From(3));
        Assert.Equal(KajayValue.From(7), Value(survey, "expressionTarget"));

        Assert.Equal("first", survey.CurrentPageName);
        survey.SetValue("source", KajayValue.From(4));
        Assert.Equal("second", survey.CurrentPageName);

        SurveyCompletedEventArgs? completion = null;
        survey.Completed += (_, args) => completion = args;
        survey.SetValue("source", KajayValue.From(5));
        Assert.True(survey.IsCompleted);
        Assert.NotNull(completion);
        Assert.Equal(KajayValue.From(5), completion.Data["source"]);
        Assert.Equal(
            [
                "source",
                "setTarget",
                "setTarget",
                "source",
                "copyTarget",
                "source",
                "expressionTarget",
                "source",
                "source",
            ],
            valueChanges);
    }

    [Fact]
    public void TriggerWritesCascadeThroughCalculatedValuesAndLaterTriggers()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "calculatedValues": [
                {"name":"derived","expression":"{intermediate} * 2"}
              ],
              "triggers": [
                {
                  "type":"setvalue",
                  "expression":"{start} = true",
                  "setToName":"intermediate",
                  "setValue":21
                },
                {
                  "type":"runexpression",
                  "expression":"{derived} = 42",
                  "setToName":"result",
                  "runExpression":"{derived} + 1"
                }
              ],
              "pages": [{"name":"one"}]
            }
            """)
            .Definition
            .CreateSurvey();
        List<string> changes = [];
        survey.ValueChanged += (_, change) =>
        {
            changes.Add(change.Name);
            if (change.Name == "start")
            {
                Assert.Equal(KajayValue.From(43), Value(survey, "result"));
            }
        };

        survey.SetValue("start", KajayValue.From(true));

        Assert.Equal(KajayValue.From(21), Value(survey, "intermediate"));
        Assert.Equal(KajayValue.From(42), Calculated(survey, "derived"));
        Assert.Equal(KajayValue.From(43), Value(survey, "result"));
        Assert.Equal(["start", "intermediate", "result"], changes);
    }

    [Fact]
    public void SkipAcceptsAPageNameAndAnOwningQuestionName()
    {
        Survey survey = CreateSurvey();

        survey.SetValue("source", KajayValue.From(4));
        Assert.Equal("second", survey.CurrentPageName);
        Assert.True(survey.GoToPage("first"));

        survey.SetValue("source", KajayValue.From(6));
        Assert.Equal("third", survey.CurrentPageName);
    }

    private static Survey CreateSurvey()
    {
        return SurveyDefinition.Parse(
            """
            {
              "calculatedValues": [
                {"name":"doubled","expression":"{source} * 2"}
              ],
              "triggers": [
                {"type":"setvalue","expression":"{source} = 1","setToName":"setTarget","setValue":"literal"},
                {"type":"copyvalue","expression":"{source} = 2","setToName":"copyTarget","fromName":"source"},
                {"type":"runexpression","expression":"{source} = 3","setToName":"expressionTarget","runExpression":"{doubled} + 1"},
                {"type":"skip","expression":"{source} = 4","gotoName":"destination"},
                {"type":"complete","expression":"{source} = 5"},
                {"type":"skip","expression":"{source} = 6","gotoName":"third"}
              ],
              "pages": [
                {"name":"first","elements":[{"type":"text","name":"source"}]},
                {"name":"second","elements":[{"type":"panel","name":"group","elements":[{"type":"text","name":"destination"}]}]},
                {"name":"third"}
              ]
            }
            """)
            .Definition
            .CreateSurvey();
    }

    private static KajayValue Value(Survey survey, string name)
    {
        Assert.True(survey.TryGetValue(name, out KajayValue value));
        return value;
    }

    private static KajayValue Calculated(Survey survey, string name)
    {
        Assert.True(survey.TryGetCalculatedValue(name, out KajayValue value));
        return value;
    }
}
