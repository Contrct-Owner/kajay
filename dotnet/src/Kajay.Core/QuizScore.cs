namespace Kajay;

/// <summary>Measures the marks earned by the current reachable quiz questions.</summary>
/// <param name="Earned">Marks earned.</param>
/// <param name="Possible">Marks available.</param>
/// <param name="QuestionCount">Questions carrying an authored correct answer.</param>
/// <param name="Ratio">Earned divided by possible, or zero when nothing is graded.</param>
public sealed record QuizScore(
    double Earned,
    double Possible,
    int QuestionCount,
    double Ratio);
