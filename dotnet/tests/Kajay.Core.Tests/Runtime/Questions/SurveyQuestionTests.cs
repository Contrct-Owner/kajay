namespace Kajay.Core.Tests;

public sealed class SurveyQuestionTests
{
    [Fact]
    public void QuestionsExposeDefinitionOrderIdentityValueAndState()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"text","name":"primary","valueName":"shared"},{"type":"text","name":"secondary","valueName":"shared","visibleIf":"{show} = true"}]}]}""")
            .Definition
            .CreateSurvey();

        Assert.Equal(["primary", "secondary"], survey.Questions.Select(question => question.Name));
        SurveyQuestion primary = Assert.IsType<SurveyScalarQuestion>(survey.GetQuestion("primary"));
        SurveyQuestion secondary = Assert.IsType<SurveyScalarQuestion>(survey.GetQuestion("secondary"));
        Assert.Equal("text", primary.Type);
        Assert.Equal("shared", primary.ValueName);
        Assert.False(secondary.State.IsReachable);

        primary.SetValue(KajayValue.From("same answer"));
        Assert.Equal(KajayValue.From("same answer"), secondary.Value);
        primary.Clear();
        Assert.Equal(KajayValue.Absent, secondary.Value);
        Assert.Null(survey.GetQuestion("missing"));
    }

    [Fact]
    public void SingleChoiceMatchesRestoredNumericTextToTheAuthoredValue()
    {
        Survey survey = CreateChoiceSurvey();
        SurveyChoiceQuestion single = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("single"));

        Assert.Equal(
            [KajayValue.From(1), KajayValue.From(2)],
            single.Choices);
        single.Select(KajayValue.From("2"));

        Assert.Equal(KajayValue.From(2), single.Value);
        Assert.True(single.IsSelected(KajayValue.From("2")));
        single.Deselect(KajayValue.From(2));
        Assert.Equal(KajayValue.Absent, single.Value);
    }

    [Fact]
    public void MultipleChoicesPreserveOrderDeduplicateAndRemoveEmptyResponses()
    {
        Survey survey = CreateChoiceSurvey();
        SurveyChoiceQuestion multiple = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("multiple"));

        multiple.Select(KajayValue.From("beta"));
        multiple.Select(KajayValue.From("alpha"));
        multiple.Select(KajayValue.From("beta"));
        Assert.Equal(
            [KajayValue.From("beta"), KajayValue.From("alpha")],
            multiple.Value.GetArray());

        multiple.Deselect(KajayValue.From("beta"));
        multiple.Deselect(KajayValue.From("alpha"));
        Assert.Equal(KajayValue.Absent, multiple.Value);
        Assert.Throws<ArgumentException>(() => multiple.Select(KajayValue.From("unknown")));
    }

    [Fact]
    public void RankingSelectionUsesCallerSuppliedOrder()
    {
        Survey survey = CreateChoiceSurvey();
        SurveyChoiceQuestion ranking = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("ranking"));

        ranking.SetSelection(
            [KajayValue.From("third"), KajayValue.From("first"), KajayValue.From("third")]);

        Assert.Equal(
            [KajayValue.From("third"), KajayValue.From("first")],
            ranking.Value.GetArray());
    }

    private static Survey CreateChoiceSurvey()
    {
        return SurveyDefinition.Parse(
            """
            {
              "pages":[{
                "name":"one",
                "elements":[
                  {"type":"radiogroup","name":"single","choices":[1,{"value":2,"text":"Two"}]},
                  {"type":"checkbox","name":"multiple","choices":["alpha","beta"]},
                  {"type":"ranking","name":"ranking","choices":["first","second","third"]}
                ]
              }]
            }
            """)
            .Definition
            .CreateSurvey();
    }
}
