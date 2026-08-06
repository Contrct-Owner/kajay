namespace Kajay;

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
            .Where(question => question.HasCorrectAnswer)
            .ToArray();
        double earned = questions.Count(question =>
            survey.GetValue(question.Name) == question.CorrectAnswer);
        double possible = questions.Length;
        return new QuizScore(
            earned,
            possible,
            questions.Length,
            possible == 0 ? 0 : earned / possible);
    }
}
