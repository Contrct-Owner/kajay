namespace Kajay;

/// <summary>The externally observable phase of a survey instance.</summary>
public enum SurveyState
{
    /// <summary>The definition has no pages to run.</summary>
    Empty,

    /// <summary>The survey accepts answers and navigation.</summary>
    Running,

    /// <summary>The survey is waiting for host work.</summary>
    Loading,

    /// <summary>The survey is showing its completion preview.</summary>
    Preview,

    /// <summary>The survey has completed.</summary>
    Completed,
}
