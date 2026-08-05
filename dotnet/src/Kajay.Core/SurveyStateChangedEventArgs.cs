namespace Kajay;

/// <summary>Provides the survey state observed after a lifecycle transition.</summary>
public sealed class SurveyStateChangedEventArgs : EventArgs
{
    internal SurveyStateChangedEventArgs(SurveyState state)
    {
        State = state;
    }

    /// <summary>Gets the current survey state.</summary>
    public SurveyState State { get; }
}
