using Kajay.Expressions;

namespace Kajay.Core.Tests;

public sealed class SurveyFillInTheBlankTests
{
    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: prose splits into text and gaps")]
    public void ProseSplitsIntoTextAndGaps()
    {
        IReadOnlyList<BlankSegment> segments = BlankTemplate.Parse("The capital is [[capital]].");

        Assert.Equal(
            [
                new BlankSegment(BlankSegmentKind.Text, "The capital is "),
                new BlankSegment(BlankSegmentKind.Blank, "capital"),
                new BlankSegment(BlankSegmentKind.Text, "."),
            ],
            segments);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: brackets that name nothing are prose")]
    public void BracketsThatNameNothingAreProse()
    {
        // `[[` opens a blank only when a valid name and `]]` follow, so no escape character
        // has to live in authored prose — or in a translator's copy of it. A dotted name is
        // not a blank either: the answer is read from an expression as `{q.capital}`.
        foreach (string template in new[] { "see [[1]]", "an [[ open", "and [[a.b]] too" })
        {
            Assert.Equal(
                [new BlankSegment(BlankSegmentKind.Text, template)],
                BlankTemplate.Parse(template));
        }
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: an answer is one object keyed by blank name")]
    public void AnAnswerIsOneObjectKeyedByBlankName()
    {
        Survey survey = Build();
        SurveyFillInTheBlankQuestion question = Question(survey);

        question.SetBlankValue("capital", KajayValue.From("Paris"));

        Assert.Equal("Paris", question.GetBlankValue("capital").GetString());
        Assert.Equal(["geography"], survey.Data.Keys);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: emptying the last blank leaves no answer")]
    public void EmptyingTheLastBlankLeavesNoAnswer()
    {
        Survey survey = Build();
        SurveyFillInTheBlankQuestion question = Question(survey);
        question.SetBlankValue("capital", KajayValue.From("Paris"));

        question.SetBlankValue("capital", KajayValue.From(string.Empty));

        // An empty map is not empty by any test the engine applies, so a required question
        // would be satisfied by a sentence nobody filled in.
        Assert.Empty(survey.Data);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: each marked blank is worth a mark")]
    public void EachMarkedBlankIsWorthAMark()
    {
        Survey survey = Build();
        SurveyFillInTheBlankQuestion question = Question(survey);
        question.SetBlankValue("capital", KajayValue.From("Paris"));
        question.SetBlankValue("currency", KajayValue.From("Euro"));

        QuizScore score = survey.GetQuizScore();

        // Partial credit, which this runtime could not express until scoring became a pair.
        Assert.Equal(2, score.Earned);
        Assert.Equal(2, score.Possible);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: half a sentence earns half the marks")]
    public void HalfASentenceEarnsHalfTheMarks()
    {
        Survey survey = Build();
        SurveyFillInTheBlankQuestion question = Question(survey);
        question.SetBlankValue("capital", KajayValue.From("Paris"));
        question.SetBlankValue("currency", KajayValue.From("Dollar"));

        Assert.Equal(1, survey.GetQuizScore().Earned);
        Assert.Equal(2, survey.GetQuizScore().Possible);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: case and whitespace are forgiven by default")]
    public void CaseAndWhitespaceAreForgivenByDefault()
    {
        Survey survey = Build();
        SurveyFillInTheBlankQuestion question = Question(survey);
        question.SetBlankValue("capital", KajayValue.From("  paris "));
        question.SetBlankValue("currency", KajayValue.From("EURO"));

        // An assessment marking `paris` wrong is measuring typing rather than geography.
        Assert.Equal(2, survey.GetQuizScore().Earned);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: a blank may insist on case")]
    public void ABlankMayInsistOnCase()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"fillintheblank","name":"geography",
              "template":"[[code]]","blanks":[
                {"type":"text","name":"code","correctAnswer":"KJ","caseSensitive":true}]}]}]}
            """).Definition.CreateSurvey();
        Question(survey).SetBlankValue("code", KajayValue.From("kj"));

        // One sentence can hold a prose answer and a case-sensitive code.
        Assert.Equal(0, survey.GetQuizScore().Earned);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: a numeric answer marks a typed one")]
    public void ANumericAnswerMarksATypedOne()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"fillintheblank","name":"geography",
              "template":"[[n]]","blanks":[{"type":"text","name":"n","correctAnswer":42}]}]}]}
            """).Definition.CreateSurvey();
        Question(survey).SetBlankValue("n", KajayValue.From("42"));

        // A respondent types into an input and gets text back; refusing to look at it would
        // mark every numeric answer wrong.
        Assert.Equal(1, survey.GetQuizScore().Earned);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: a sentence nobody marked is not in the quiz")]
    public void ASentenceNobodyMarkedIsNotInTheQuiz()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"fillintheblank","name":"geography",
              "template":"[[a]]","blanks":[{"type":"text","name":"a"}]}]}]}
            """).Definition.CreateSurvey();

        // Membership is asked of the blanks; the question-level correct answer this type
        // inherits means nothing here.
        Assert.Equal(0, survey.GetQuizScore().QuestionCount);
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: a blank is a question, so it brings its own title")]
    public void ABlankIsAQuestionSoItBringsItsOwnTitle()
    {
        SurveyFillInTheBlankQuestion question = Question(Build());

        // What an adapter names the gap to a screen reader — and it comes from the question
        // rather than from anything a private item type had to declare for itself.
        Assert.Equal("Capital city", question.GetBlank("capital")?.Title);
        Assert.Null(question.GetBlank("unknown"));
    }

    [Fact(DisplayName = "parity/Q12-fill-in-the-blank: a multi-select blank earns partial credit")]
    public void AMultiSelectBlankEarnsPartialCredit()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"fillintheblank","name":"geography",
              "template":"cities include [[cities]]","blanks":[
                {"type":"tagbox","name":"cities","choices":["Paris","Lyon","Nice"],
                 "correctAnswer":["Paris","Lyon"]}]}]}]}
            """).Definition.CreateSurvey();
        Question(survey).SetBlankValue("cities", KajayValue.FromArray([KajayValue.From("Paris")]));

        // Scored by the rule a checkbox uses, because it *is* one. This could not be
        // expressed until scoring became a pair.
        QuizScore score = survey.GetQuizScore();
        Assert.Equal(1, score.Earned);
        Assert.Equal(2, score.Possible);
    }

    private static Survey Build()
    {
        return SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"fillintheblank","name":"geography",
              "template":"The capital of France is [[capital]] and its currency is the [[currency]].",
              "blanks":[
                {"type":"text","name":"capital","title":"Capital city","correctAnswer":"Paris"},
                {"type":"text","name":"currency","title":"Currency","correctAnswer":"Euro"}]}]}]}
            """).Definition.CreateSurvey();
    }

    private static SurveyFillInTheBlankQuestion Question(Survey survey)
    {
        return Assert.IsType<SurveyFillInTheBlankQuestion>(survey.GetQuestion("geography"));
    }
}
