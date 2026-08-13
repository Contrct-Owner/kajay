namespace Kajay.Core.Tests;

public sealed class SurveyPartialCreditTests
{
    [Fact(DisplayName = "parity/Q5-partial-credit: a multi-select is worth a mark per expected choice")]
    public void AMultiSelectIsWorthAMarkPerExpectedChoice()
    {
        Survey survey = Checkbox();
        survey.SetValue("q", Selection("a", "b"));

        QuizScore score = survey.GetQuizScore();

        // Several decisions wearing one question. One comparison could only ever be worth
        // one mark, which is what this runtime used to award.
        Assert.Equal(2, score.Earned);
        Assert.Equal(2, score.Possible);
        Assert.Equal(1, score.QuestionCount);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: half right earns half the marks")]
    public void HalfRightEarnsHalfTheMarks()
    {
        Survey survey = Checkbox();
        survey.SetValue("q", Selection("a"));

        QuizScore score = survey.GetQuizScore();

        // Previously zero: the whole answer was compared with the whole expected answer,
        // so a partially right respondent scored the same as one who answered nothing.
        Assert.Equal(1, score.Earned);
        Assert.Equal(2, score.Possible);
        Assert.Equal(0.5, score.Ratio);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: a wrong choice is charged for")]
    public void AWrongChoiceIsChargedFor()
    {
        Survey survey = Checkbox();
        survey.SetValue("q", Selection("a", "c"));

        // Rewarding matches and charging for extras is the only arrangement where the best
        // strategy is to answer honestly; counting matches alone would make ticking every
        // box worth full marks.
        Assert.Equal(0, survey.GetQuizScore().Earned);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: ticking everything is not worth full marks")]
    public void TickingEverythingIsNotWorthFullMarks()
    {
        Survey survey = Checkbox();
        survey.SetValue("q", Selection("a", "b", "c"));

        // Two matched less one that should not be there. Counting matches alone would make
        // ticking every box worth the full two, turning a partial-credit question into a
        // free one — the subtraction is what stops that, not a floor at zero.
        Assert.Equal(1, survey.GetQuizScore().Earned);
        Assert.Equal(2, survey.GetQuizScore().Possible);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: marks never fall below zero")]
    public void MarksNeverFallBelowZero()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"checkbox","name":"q","choices":["a","b","c","d"],"correctAnswer":["a"]}]}]}
            """).Definition.CreateSurvey();
        survey.SetValue("q", Selection("b", "c", "d"));

        // Three wrong against one right. A question is worth no marks at its worst; taking
        // marks from elsewhere is not something a quiz may do silently.
        Assert.Equal(0, survey.GetQuizScore().Earned);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: a single expected value is a list of one")]
    public void ASingleExpectedValueIsAListOfOne()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"checkbox","name":"q","choices":["a","b"],"correctAnswer":"a"}]}]}
            """).Definition.CreateSurvey();
        survey.SetValue("q", Selection("a"));

        // Falling through to the base comparison would measure an array against a scalar
        // and mark every respondent wrong.
        Assert.Equal(1, survey.GetQuizScore().Earned);
        Assert.Equal(1, survey.GetQuizScore().Possible);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: a ranking is still marked whole, because order is the answer")]
    public void ARankingIsStillMarkedWhole()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"ranking","name":"q","choices":["a","b"],"correctAnswer":["a","b"]}]}]}
            """).Definition.CreateSurvey();
        survey.SetValue("q", Selection("b", "a"));

        // `AllowsMultiple` is true for a ranking, and keying partial credit off that would
        // have scored a respondent who listed the right items backwards as entirely
        // correct — fixing one divergence by introducing another. The order *is* the
        // response, so the whole answer is compared, exactly as TypeScript does.
        Assert.Equal(0, survey.GetQuizScore().Earned);
        Assert.Equal(1, survey.GetQuizScore().Possible);
    }

    [Fact(DisplayName = "parity/Q5-partial-credit: a single-answer question is unchanged")]
    public void ASingleAnswerQuestionIsUnchanged()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"text","name":"q","correctAnswer":"42"}]}]}
            """).Definition.CreateSurvey();
        survey.SetValue("q", KajayValue.From("42"));

        Assert.Equal(1, survey.GetQuizScore().Earned);
        Assert.Equal(1, survey.GetQuizScore().Possible);
    }

    private static Survey Checkbox()
    {
        return SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"checkbox","name":"q","choices":["a","b","c"],"correctAnswer":["a","b"]}]}]}
            """).Definition.CreateSurvey();
    }

    private static KajayValue Selection(params string[] choices)
    {
        return KajayValue.FromArray(choices.Select(KajayValue.From).ToArray());
    }
}
