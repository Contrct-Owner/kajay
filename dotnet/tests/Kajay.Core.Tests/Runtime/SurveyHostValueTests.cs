namespace Kajay.Core.Tests;

public sealed class SurveyHostValueTests
{
    [Fact(DisplayName = "parity/Q11-host-values: ExpressionsReadTheHostScopeAndTheResponseNeverCarriesIt")]
    public void ExpressionsReadTheHostScopeAndTheResponseNeverCarriesIt()
    {
        Survey survey = CreateSurvey(new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["tier"] = KajayValue.From("gold"),
        });

        Assert.True(QuestionState(survey, "upgrade").IsVisible);

        survey.SetValue("plan", KajayValue.From("pro"));

        // Structurally absent, not filtered on the way out: a host value was never in the
        // answer map, so there is nothing for the response to exclude.
        Assert.Equal(["plan"], survey.Data.Keys.Order(StringComparer.Ordinal));
    }

    [Fact(DisplayName = "parity/Q11-host-values: TheSigilIsTestedBeforeTheAnswerSpaceInBothDirections")]
    public void TheSigilIsTestedBeforeTheAnswerSpaceInBothDirections()
    {
        Survey survey = CreateSurvey(new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["tier"] = KajayValue.From("gold"),
        });

        survey.SetValue("tier", KajayValue.From("bronze"));

        // An answer of the same name is a different name: it neither shadows the host value
        // nor is reachable through the host scope.
        Assert.True(QuestionState(survey, "upgrade").IsVisible);
        Assert.False(QuestionState(survey, "answerTier").IsVisible);
    }

    [Fact(DisplayName = "parity/Q11-host-values: StructuredHostValuesAreDescendedInto")]
    public void StructuredHostValuesAreDescendedInto()
    {
        Survey survey = CreateSurvey(new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["profile"] = KajayValue.FromObject(
                new Dictionary<string, KajayValue>(StringComparer.Ordinal)
                {
                    ["plan"] = KajayValue.FromObject(
                        new Dictionary<string, KajayValue>(StringComparer.Ordinal)
                        {
                            ["tier"] = KajayValue.From("gold"),
                        }),
                }),
        });

        Assert.True(QuestionState(survey, "descended").IsVisible);
    }

    [Fact(DisplayName = "parity/Q11-host-values: AWriteRecomputesEverythingThatReadsIt")]
    public void AWriteRecomputesEverythingThatReadsIt()
    {
        Survey survey = CreateSurvey(new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["tier"] = KajayValue.From("bronze"),
        });
        Assert.False(QuestionState(survey, "upgrade").IsVisible);
        List<string> states = [];
        survey.ElementStateChanged += (_, change) => states.Add(change.Name);

        survey.SetHostValue("tier", KajayValue.From("gold"));

        // Unlike a deployment endpoint, a host value is a real graph root: a condition reading
        // it re-runs rather than holding the answer it first computed.
        Assert.True(QuestionState(survey, "upgrade").IsVisible);
        Assert.Contains("upgrade", states);
    }

    [Fact(DisplayName = "parity/Q11-host-values: WritingTheValueAlreadyInForceAnnouncesNothing")]
    public void WritingTheValueAlreadyInForceAnnouncesNothing()
    {
        Survey survey = CreateSurvey(new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["tier"] = KajayValue.From("gold"),
        });
        List<string> states = [];
        survey.ElementStateChanged += (_, change) => states.Add(change.Name);

        survey.SetHostValue("tier", KajayValue.From("gold"));

        // A host free to refresh its context on a timer must not make the survey recompute
        // for a value that did not move.
        Assert.Empty(states);
    }

    [Fact(DisplayName = "parity/Q11-host-values: AHostValueChangeIsNotAnnouncedAsAnAnswerChange")]
    public void AHostValueChangeIsNotAnnouncedAsAnAnswerChange()
    {
        Survey survey = CreateSurvey(new Dictionary<string, KajayValue>(StringComparer.Ordinal)
        {
            ["tier"] = KajayValue.From("bronze"),
        });
        List<string> values = [];
        survey.ValueChanged += (_, change) => values.Add(change.Name);

        survey.SetHostValue("tier", KajayValue.From("gold"));

        // That event means an answer changed, and a host value is in no response for a
        // handler to go and read.
        Assert.Empty(values);
    }

    private static Survey CreateSurvey(IReadOnlyDictionary<string, KajayValue> hostValues)
    {
        return SurveyDefinition.Parse(
            """
            {
              "pages":[
                {
                  "name":"p1",
                  "elements":[
                    {"type":"text","name":"plan"},
                    {"type":"text","name":"tier"},
                    {"type":"text","name":"upgrade","visibleIf":"{$tier} = 'gold'"},
                    {"type":"text","name":"answerTier","visibleIf":"{tier} = 'gold'"},
                    {
                      "type":"text",
                      "name":"descended",
                      "visibleIf":"{$profile.plan.tier} = 'gold'"
                    }
                  ]
                }
              ]
            }
            """)
            .Definition
            .CreateSurvey(new SurveyOptions { HostValues = hostValues });
    }

    private static SurveyQuestionState QuestionState(Survey survey, string name)
    {
        Assert.True(survey.TryGetQuestionState(name, out SurveyQuestionState state));
        return state;
    }
}
