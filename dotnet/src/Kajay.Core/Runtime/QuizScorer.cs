namespace Kajay.Runtime;

internal static class QuizScorer
{
    public static QuizScore Score(
        Survey survey,
        SurveyRuntimeDefinition definition)
    {
        SurveyRuntimeQuestion[] questions = definition.Pages
            .Where((_, index) => survey.IsAuthoredPageVisible(index))
            .SelectMany(page => page.Questions)
            .Where(question => survey.TryGetQuestionState(
                question.Name,
                out SurveyQuestionState state) && state.IsReachable)
            // Asked of the bound question, because membership can belong to its parts.
            .Where(question => survey.GetQuestion(question.Name)?.IsMarked ?? false)
            .ToArray();
        // Asked of the question rather than compared here, so partial credit is the
        // question type's business: a multi-select is worth a mark per expected choice,
        // and one comparison in this loop could only ever be worth one.
        AnswerScore[] scores = questions
            .Select(question => survey.ScoreQuestion(question.Name))
            .ToArray();
        double earned = scores.Sum(score => score.Earned);
        double possible = scores.Sum(score => score.Possible);
        return new QuizScore(
            earned,
            possible,
            questions.Length,
            possible == 0 ? 0 : earned / possible);
    }
}
