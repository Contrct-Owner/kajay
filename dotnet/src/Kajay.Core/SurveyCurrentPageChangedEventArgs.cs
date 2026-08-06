namespace Kajay;

/// <summary>Describes a committed current-page change.</summary>
public sealed class SurveyCurrentPageChangedEventArgs : EventArgs
{
    internal SurveyCurrentPageChangedEventArgs(int previousPageIndex, int currentPageIndex)
    {
        PreviousPageIndex = previousPageIndex;
        CurrentPageIndex = currentPageIndex;
    }

    /// <summary>Gets the previous zero-based effective page index.</summary>
    public int PreviousPageIndex { get; }

    /// <summary>Gets the current zero-based effective page index.</summary>
    public int CurrentPageIndex { get; }
}
