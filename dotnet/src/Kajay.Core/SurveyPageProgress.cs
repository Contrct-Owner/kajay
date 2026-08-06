namespace Kajay;

/// <summary>Reports the respondent's position in the effective page sequence.</summary>
/// <param name="CurrentPageNumber">The one-based page number, or zero for an empty survey.</param>
/// <param name="PageCount">The number of effective pages.</param>
/// <param name="Ratio">The current page number divided by the page count, or zero when empty.</param>
public sealed record SurveyPageProgress(
    int CurrentPageNumber,
    int PageCount,
    double Ratio);
