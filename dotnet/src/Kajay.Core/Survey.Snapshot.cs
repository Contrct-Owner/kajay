namespace Kajay;

public sealed partial class Survey
{
    /// <summary>Captures durable, definition-bound state in Response Snapshot Format v1.</summary>
    public SurveySnapshot CreateSnapshot()
    {
        if (State is SurveyState.Loading)
        {
            throw new InvalidOperationException(
                "A Response Snapshot cannot capture the host-owned loading state.");
        }
        return new SurveySnapshot(
            _definitionDigest,
            _answers,
            CurrentPageName,
            Locale,
            State,
            Timer.CaptureAnchors());
    }

    /// <summary>Restores a compatible Response Snapshot without replaying runtime events.</summary>
    public void RestoreSnapshot(SurveySnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        if (!string.Equals(_definitionDigest, snapshot.DefinitionDigest, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "The Response Snapshot definition digest does not match this Survey.");
        }
        _isRestoringSnapshot = true;
        try
        {
            _answers.Clear();
            foreach ((string name, KajayValue value) in snapshot.Data)
            {
                if (value.Kind is not KajayValueKind.Absent)
                {
                    _answers[name] = value;
                }
            }
            SettleAllLogic();
            _currentPageIndex = 0;
            if (snapshot.PageName.Length > 0)
            {
                _ = GoToPage(snapshot.PageName);
            }
            SetLocale(snapshot.Locale);
            _isLoading = false;
            _isPreviewing = snapshot.Lifecycle is SurveyState.Preview;
            _isCompleted = snapshot.Lifecycle is SurveyState.Completed;
            Timer.RestoreAnchors(snapshot.Timer);
        }
        finally
        {
            _isRestoringSnapshot = false;
        }
    }
}
