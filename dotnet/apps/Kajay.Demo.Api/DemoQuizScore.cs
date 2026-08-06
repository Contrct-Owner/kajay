namespace Kajay.Demo.Api;

public sealed record DemoQuizScore(
    double Earned,
    double Possible,
    int QuestionCount,
    double Ratio);
