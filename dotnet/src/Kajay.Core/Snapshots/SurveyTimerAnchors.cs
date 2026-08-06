namespace Kajay.Snapshots;

/// <summary>Absolute UTC anchors for a running survey and its current page.</summary>
public sealed class SurveyTimerAnchors
{
    /// <summary>Initializes absolute timer anchors.</summary>
    public SurveyTimerAnchors(DateTimeOffset surveyStartedAt, DateTimeOffset pageStartedAt)
    {
        SurveyStartedAt = surveyStartedAt;
        PageStartedAt = pageStartedAt;
    }

    /// <summary>Gets when the survey clock started.</summary>
    public DateTimeOffset SurveyStartedAt { get; }

    /// <summary>Gets when the current page clock started.</summary>
    public DateTimeOffset PageStartedAt { get; }
}
