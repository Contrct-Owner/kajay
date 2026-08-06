namespace Kajay.Core.Tests;

internal sealed record SurveyScale(
    string Name,
    int QuestionCount,
    int LogicRuleCount,
    int AnswerLeafCount,
    int QuestionsPerPage,
    TimeSpan ParseTarget,
    TimeSpan AnswerTarget,
    TimeSpan ValidationTarget,
    TimeSpan SerializationTarget,
    long RetainedByteTarget,
    long AllocationTarget)
{
    internal static SurveyScale Standard { get; } = new(
        "standard",
        250,
        1_000,
        2_500,
        50,
        TimeSpan.FromMilliseconds(100),
        TimeSpan.FromMilliseconds(2),
        TimeSpan.FromMilliseconds(5),
        TimeSpan.FromMilliseconds(50),
        25 * 1024 * 1024,
        50 * 1024 * 1024);

    internal static SurveyScale Stress { get; } = new(
        "stress",
        1_000,
        4_000,
        10_000,
        200,
        TimeSpan.FromMilliseconds(500),
        TimeSpan.FromMilliseconds(10),
        TimeSpan.FromMilliseconds(25),
        TimeSpan.FromMilliseconds(250),
        100 * 1024 * 1024,
        250 * 1024 * 1024);
}
