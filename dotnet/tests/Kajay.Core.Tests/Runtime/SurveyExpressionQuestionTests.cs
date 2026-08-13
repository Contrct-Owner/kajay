namespace Kajay.Core.Tests;

/// <summary>
/// An <c>expression</c> question is a calculated value wearing a question's clothes: it takes
/// no respondent input, it is named, and its value belongs in the response. This runtime used
/// to build it as a plain scalar with no rule behind it, so it stayed absent for ever and any
/// survey holding one answered differently from the TypeScript runtime.
/// </summary>
public sealed class SurveyExpressionQuestionTests
{
    [Fact(DisplayName = "parity/Q5-expression-questions: a computed question reaches the response")]
    public void AComputedQuestionReachesTheResponse()
    {
        Survey survey = Page();

        survey.SetValue("n", KajayValue.From(3d));

        _ = survey.TryGetValue("total", out KajayValue total);
        Assert.Equal(6d, total.GetNumber());
        Assert.Equal(["n", "total"], survey.Data.Keys.Order(StringComparer.Ordinal));
    }

    [Fact(DisplayName = "parity/Q5-expression-questions: a computed question recomputes and announces once")]
    public void AComputedQuestionRecomputesAndAnnouncesOnce()
    {
        Survey survey = Page();
        List<string> announced = [];
        survey.ValueChanged += (_, change) => announced.Add(change.Name);

        survey.SetValue("n", KajayValue.From(3d));
        survey.SetValue("n", KajayValue.From(4d));

        // Announced as an answer change, because that is what a value in the response is: a
        // host saving on every change writes the computed value it would have got by reading.
        _ = survey.TryGetValue("total", out KajayValue total);
        Assert.Equal(8d, total.GetNumber());
        Assert.Equal(["n", "total", "n", "total"], announced);
    }

    [Fact(DisplayName = "parity/Q5-expression-questions: a computed question with no result is in no response")]
    public void AComputedQuestionWithNoResultIsInNoResponse()
    {
        Survey survey = Page();

        // Nothing has been answered, so there is nothing to compute. The value used to be
        // recorded regardless — an untouched survey answered `{ "total": absent }`, which
        // says a question was answered when none was, and which TypeScript never did.
        Assert.Empty(survey.Data);
    }

    [Fact(DisplayName = "parity/Q5-expression-questions: a computed gap fills in inside its sentence")]
    public void AComputedGapFillsInInsideItsSentence()
    {
        Survey survey = Sentence();
        SurveyFillInTheBlankQuestion plan = Assert.IsType<SurveyFillInTheBlankQuestion>(
            survey.GetQuestion("plan"));

        plan.SetBlankValue("seats", KajayValue.From(3d));

        // Inside the sentence's own answer, where every other blank's answer is — not beside
        // it under a top-level name of its own, which would leave the gap on screen empty.
        Assert.Equal(360d, plan.GetBlankValue("annual").GetNumber());
        Assert.Equal(["plan", "total"], survey.Data.Keys.Order(StringComparer.Ordinal));
    }

    [Fact(DisplayName = "parity/Q5-expression-questions: a computed gap is read from elsewhere by its whole path")]
    public void AComputedGapIsReadFromElsewhereByItsWholePath()
    {
        Survey survey = Sentence();
        SurveyFillInTheBlankQuestion plan = Assert.IsType<SurveyFillInTheBlankQuestion>(
            survey.GetQuestion("plan"));

        plan.SetBlankValue("seats", KajayValue.From(3d));

        // Two hops in one settle: the gap computes, then the page's total reads it at
        // `plan.annual`. Nothing here declares that order — the graph derives it from the
        // path the gap's rule writes, which is why a gap can feed a total at all.
        _ = survey.TryGetValue("total", out KajayValue total);
        Assert.Equal(365d, total.GetNumber());
    }

    [Fact(DisplayName = "parity/Q5-expression-questions: emptying the gap that feeds it empties the sentence")]
    public void EmptyingTheGapThatFeedsItEmptiesTheSentence()
    {
        Survey survey = Sentence();
        SurveyFillInTheBlankQuestion plan = Assert.IsType<SurveyFillInTheBlankQuestion>(
            survey.GetQuestion("plan"));
        plan.SetBlankValue("seats", KajayValue.From(3d));

        plan.SetBlankValue("seats", KajayValue.Absent);

        // The computed gap goes with it, and an object with nothing left in it is no answer:
        // a required sentence must not be satisfied by a total the survey worked out itself.
        Assert.Equal(KajayValueKind.Absent, plan.GetBlankValue("annual").Kind);
        Assert.Empty(survey.Data);
    }

    private static Survey Page()
    {
        return SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"text","name":"n","inputType":"number"},
              {"type":"expression","name":"total","expression":"{n} * 2"}]}]}
            """).Definition.CreateSurvey();
    }

    private static Survey Sentence()
    {
        return SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"fillintheblank","name":"plan",
               "template":"We need [[seats]] seats, costing [[annual]] a year.",
               "blanks":[
                 {"type":"text","name":"seats","inputType":"number"},
                 {"type":"expression","name":"annual","expression":"{plan.seats} * 120"}]},
              {"type":"expression","name":"total","expression":"{plan.annual} + 5"}]}]}
            """).Definition.CreateSurvey();
    }
}
