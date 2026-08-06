namespace Kajay.Core.Tests;

public sealed class SurveyConditionTests
{
    [Fact]
    public void ConditionsSettleBeforeEventsAndDriveEffectivePages()
    {
        Survey survey = CreateSurvey();
        List<(string Name, SurveyConditionKind Kind, bool Value)> states = [];
        List<(int Previous, int Current)> pages = [];
        survey.ElementStateChanged += (_, change) => states.Add(
            (change.Name, change.ConditionKind, change.Value));
        survey.CurrentPageChanged += (_, change) => pages.Add(
            (change.PreviousPageIndex, change.CurrentPageIndex));
        survey.ValueChanged += (_, change) =>
        {
            if (change.Name == "showBranch")
            {
                Assert.Equal(change.Value.GetBoolean() ? 3 : 2, survey.PageCount);
            }
        };

        Assert.Equal(2, survey.PageCount);
        Assert.Equal(new SurveyPageProgress(1, 2, 0.5), survey.PageProgress);
        Assert.False(survey.IsPageVisible("branch"));

        survey.SetValue("showBranch", KajayValue.From(true));
        Assert.Equal(3, survey.PageCount);
        Assert.True(survey.IsPageVisible("branch"));
        Assert.Contains(("branch", SurveyConditionKind.Visible, true), states);

        Assert.True(survey.GoToPage("branch"));
        Assert.Equal(2, survey.CurrentPageIndex);
        states.Clear();
        survey.SetValue("showBranch", KajayValue.From(false));

        Assert.Equal(2, survey.PageCount);
        Assert.Equal(1, survey.CurrentPageIndex);
        Assert.Equal("details", survey.CurrentPageName);
        Assert.Equal((2, 1), pages[^1]);
        Assert.Contains(("branch", SurveyConditionKind.Visible, false), states);
    }

    [Fact]
    public void QuestionStateIncludesOwnConditionsAndContainerReachability()
    {
        Survey survey = CreateSurvey();

        Assert.Equal(
            new SurveyQuestionState(false, false, false, false),
            QuestionState(survey, "conditional"));
        SurveyQuestionState nested = QuestionState(survey, "nested");
        Assert.True(nested.IsVisible);
        Assert.True(nested.IsEnabled);
        Assert.False(nested.IsReachable);

        survey.SetValue("showQuestion", KajayValue.From(true));
        survey.SetValue("canEdit", KajayValue.From(true));
        survey.SetValue("mustAnswer", KajayValue.From(true));
        survey.SetValue("showPanel", KajayValue.From(true));

        Assert.Equal(
            new SurveyQuestionState(true, true, true, true),
            QuestionState(survey, "conditional"));
        Assert.True(QuestionState(survey, "nested").IsReachable);

        survey.SetValue("showPanel", KajayValue.From(false));
        Assert.True(QuestionState(survey, "nested").IsVisible);
        Assert.False(QuestionState(survey, "nested").IsReachable);
        Assert.False(survey.TryGetQuestionState("missing", out _));
    }

    [Fact]
    public void ReachabilityControlsQuizScoringAndMalformedConditionsFailSafely()
    {
        Survey survey = CreateSurvey();
        survey.SetValue("branchAnswer", KajayValue.From(42));

        Assert.Equal(new QuizScore(0, 0, 0, 0), survey.GetQuizScore());
        survey.SetValue("showBranch", KajayValue.From(true));
        Assert.Equal(new QuizScore(1, 1, 1, 1), survey.GetQuizScore());

        SurveyQuestionState malformed = QuestionState(survey, "malformed");
        Assert.True(malformed.IsVisible);
        Assert.True(malformed.IsEnabled);
        Assert.False(malformed.IsRequired);
        Assert.True(malformed.IsReachable);
    }

    private static Survey CreateSurvey()
    {
        return SurveyDefinition.Parse(
            """
            {
              "pages": [
                {"name":"start"},
                {
                  "name":"details",
                  "elements":[
                    {
                      "type":"text",
                      "name":"conditional",
                      "visibleIf":"{showQuestion} = true",
                      "enableIf":"{canEdit} = true",
                      "requiredIf":"{mustAnswer} = true"
                    },
                    {
                      "type":"panel",
                      "name":"conditionalPanel",
                      "visibleIf":"{showPanel} = true",
                      "elements":[{"type":"text","name":"nested"}]
                    },
                    {
                      "type":"text",
                      "name":"malformed",
                      "isRequired":true,
                      "visibleIf":"(",
                      "enableIf":"(",
                      "requiredIf":"("
                    }
                  ]
                },
                {
                  "name":"branch",
                  "visibleIf":"{showBranch} = true",
                  "elements":[
                    {"type":"text","name":"branchAnswer","correctAnswer":42}
                  ]
                }
              ]
            }
            """)
            .Definition
            .CreateSurvey();
    }

    private static SurveyQuestionState QuestionState(Survey survey, string name)
    {
        Assert.True(survey.TryGetQuestionState(name, out SurveyQuestionState state));
        return state;
    }
}
