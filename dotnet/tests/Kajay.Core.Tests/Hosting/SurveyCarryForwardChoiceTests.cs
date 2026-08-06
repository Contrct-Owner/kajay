namespace Kajay.Core.Tests;

public sealed class SurveyCarryForwardChoiceTests
{
    [Fact]
    public void SourceModesUpdateBeforeValueObserversRun()
    {
        Survey survey = CreateSurvey();
        var observed = new List<IReadOnlyList<KajayValue>>();
        survey.ValueChanged += (_, _) =>
        {
            observed.Add(GetChoice(survey, "selected").Choices);
        };

        GetChoice(survey, "source").SetSelection([
            KajayValue.From("a"),
            KajayValue.From("c"),
        ]);

        Assert.Equal(
            [KajayValue.From("a"), KajayValue.From("b"), KajayValue.From("c")],
            GetChoice(survey, "all").Choices);
        Assert.Equal(
            [KajayValue.From("a"), KajayValue.From("c")],
            GetChoice(survey, "selected").Choices);
        Assert.Equal(
            [KajayValue.From("b")],
            GetChoice(survey, "unselected").Choices);
        Assert.Equal(
            [KajayValue.From("a"), KajayValue.From("c")],
            Assert.Single(observed));
    }

    [Fact]
    public async Task CarryForwardWinsOverUrlAndPagingAdapters()
    {
        int calls = 0;
        Survey survey = SurveyDefinition.Parse(Definition()).Definition.CreateSurvey(
            new SurveyOptions
            {
                ChoiceFetcher = (_, _) =>
                {
                    calls += 1;
                    return ValueTask.FromResult(KajayValue.FromArray([]));
                },
                ChoicePageLoader = (_, _) =>
                {
                    calls += 1;
                    return ValueTask.FromResult(new SurveyChoicePage([], false));
                },
            });

        await survey.SettleAsync();

        Assert.Equal(0, calls);
        Assert.False(GetChoice(survey, "selected").IsPaged);
        Assert.Equal(GetChoice(survey, "source").Choices, GetChoice(survey, "all").Choices);
    }

    private static Survey CreateSurvey()
    {
        return SurveyDefinition.Parse(Definition()).Definition.CreateSurvey();
    }

    private static SurveyChoiceQuestion GetChoice(Survey survey, string name)
    {
        return Assert.IsType<SurveyChoiceQuestion>(survey.GetQuestion(name));
    }

    private static string Definition()
    {
        return """
            {
              "pages":[{"name":"page","elements":[
                {
                  "type":"checkbox",
                  "name":"source",
                  "choices":[
                    {"value":"a","text":"Alpha"},
                    {"value":"b","text":"Beta"},
                    {"value":"c","text":"Gamma"}
                  ]
                },
                {
                  "type":"checkbox",
                  "name":"all",
                  "choicesFromQuestion":"source",
                  "choicesFromQuestionMode":"all"
                },
                {
                  "type":"checkbox",
                  "name":"selected",
                  "choicesFromQuestion":"source",
                  "choicesFromQuestionMode":"selected",
                  "choicesByUrl":"unused",
                  "choicesLazyLoadEnabled":true
                },
                {
                  "type":"checkbox",
                  "name":"unselected",
                  "choicesFromQuestion":"source",
                  "choicesFromQuestionMode":"unselected"
                }
              ]}]
            }
            """;
    }
}
