namespace Kajay;

/// <summary>A mutable, single-owner instance of a parsed survey definition.</summary>
public sealed class Survey
{
    internal Survey(bool hasPages)
    {
        State = hasPages ? SurveyState.Running : SurveyState.Empty;
    }

    /// <summary>Gets the current lifecycle state.</summary>
    public SurveyState State { get; private set; }
}
