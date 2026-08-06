namespace Kajay.Core.Tests;

public sealed class SurveyRuntimeFlowParityTests
{
    [Fact(DisplayName = "parity/Q5-runtime-flow")]
    public async Task PublicRuntimeFlowSettlesNavigatesScoresTimesAndCompletes()
    {
        var clock = new ManualTimeProvider(DateTimeOffset.UnixEpoch);
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "maxTimeToFinish":10,
              "calculatedValues":[
                {"name":"doubled","expression":"{answer} * 2","includeIntoResult":true}
              ],
              "triggers":[
                {"type":"setvalue","expression":"{answer} = 21","setToName":"triggered","setValue":true}
              ],
              "pages":[
                {"name":"start","elements":[{"type":"text","name":"answer"}]},
                {
                  "name":"branch",
                  "visibleIf":"{showBranch} = true",
                  "elements":[{"type":"text","name":"quiz","correctAnswer":42}]
                }
              ]
            }
            """)
            .Definition
            .CreateSurvey(new SurveyOptions { TimeProvider = clock });
        List<SurveyState> states = [];
        List<string> values = [];
        List<(int Previous, int Current)> pages = [];
        List<(string Name, SurveyConditionKind Kind, bool Value)> elements = [];
        SurveyCompletedEventArgs? completion = null;
        survey.StateChanged += (_, change) => states.Add(change.State);
        survey.ValueChanged += (_, change) => values.Add(change.Name);
        survey.CurrentPageChanged += (_, change) => pages.Add(
            (change.PreviousPageIndex, change.CurrentPageIndex));
        survey.ElementStateChanged += (_, change) => elements.Add(
            (change.Name, change.ConditionKind, change.Value));
        survey.Completed += (_, change) => completion = change;

        survey.SetLoading(true);
        survey.SetLoading(false);
        survey.EnterPreview();
        survey.CancelPreview();
        survey.SetValue("answer", KajayValue.From(21));
        survey.SetValue("showBranch", KajayValue.From(true));
        survey.SetValue("quiz", KajayValue.From(42));

        Assert.Equal(KajayValue.From(42), Value(survey, "doubled"));
        Assert.Equal(KajayValue.From(true), Value(survey, "triggered"));
        Assert.Equal(2, survey.PageCount);
        Assert.Equal(new QuizScore(1, 1, 1, 1), survey.GetQuizScore());
        Assert.Equal(
            SurveyAdvanceOutcome.Advanced,
            await survey.AdvanceAsync(CancellationToken.None));
        Assert.Equal("branch", survey.CurrentPageName);
        Assert.Equal(new SurveyPageProgress(2, 2, 1), survey.PageProgress);

        survey.Timer.Start();
        clock.Advance(TimeSpan.FromSeconds(10));
        survey.Timer.Tick();

        Assert.True(survey.IsCompleted);
        Assert.False(survey.Timer.IsRunning);
        Assert.NotNull(completion);
        Assert.Equal(KajayValue.From(42), completion.Data["doubled"]);
        Assert.Equal(
            [SurveyState.Loading, SurveyState.Running, SurveyState.Preview,
                SurveyState.Running, SurveyState.Completed],
            states);
        Assert.Equal(
            ["answer", "doubled", "triggered", "showBranch", "quiz"],
            values);
        Assert.Equal([(0, 1)], pages);
        Assert.Contains(("branch", SurveyConditionKind.Visible, true), elements);
    }

    private static KajayValue Value(Survey survey, string name)
    {
        Assert.True(survey.TryGetValue(name, out KajayValue value));
        return value;
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }

        internal void Advance(TimeSpan duration)
        {
            now += duration;
        }
    }
}
