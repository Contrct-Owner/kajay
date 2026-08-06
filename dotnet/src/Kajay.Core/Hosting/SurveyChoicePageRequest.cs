namespace Kajay.Hosting;

/// <summary>Describes one page of choices requested from a host adapter.</summary>
/// <param name="QuestionName">The exact authored question name.</param>
/// <param name="Skip">The number of choices already loaded for this filter.</param>
/// <param name="Take">The authored page size.</param>
/// <param name="Filter">The trimmed server-side filter.</param>
/// <param name="Clock">The explicit UTC clock captured for this request.</param>
public sealed record SurveyChoicePageRequest(
    string QuestionName,
    int Skip,
    int Take,
    string Filter,
    DateTimeOffset Clock);
