namespace Kajay;

/// <summary>A mutable, single-owner instance of a parsed survey definition.</summary>
public sealed class Survey
{
    private readonly bool _hasPages;
    private readonly Dictionary<string, KajayValue> _answers = new(StringComparer.Ordinal);
    private bool _isLoading;
    private bool _isPreviewing;
    private bool _isCompleted;

    internal Survey(bool hasPages)
    {
        _hasPages = hasPages;
    }

    /// <summary>Gets the current lifecycle state.</summary>
    public SurveyState State => ResolveState();

    /// <summary>Raised after a lifecycle transition is committed.</summary>
    public event EventHandler<SurveyStateChangedEventArgs>? StateChanged;

    /// <summary>Raised after an answer changes.</summary>
    public event EventHandler<SurveyValueChangedEventArgs>? ValueChanged;

    /// <summary>Raised once with the submitted answer snapshot.</summary>
    public event EventHandler<SurveyCompletedEventArgs>? Completed;

    /// <summary>Gets an immutable snapshot of the current answers.</summary>
    public IReadOnlyDictionary<string, KajayValue> Data =>
        new System.Collections.ObjectModel.ReadOnlyDictionary<string, KajayValue>(
            new Dictionary<string, KajayValue>(_answers, StringComparer.Ordinal));

    /// <summary>Reports whether the host is waiting for external work.</summary>
    /// <param name="isLoading">Whether loading currently outranks other states.</param>
    public void SetLoading(bool isLoading)
    {
        if (_isLoading == isLoading)
        {
            return;
        }

        _isLoading = isLoading;
        RaiseStateChanged();
    }

    /// <summary>Moves from answering into a read-only completion preview.</summary>
    public void EnterPreview()
    {
        if (_isPreviewing || _isCompleted)
        {
            return;
        }

        _isPreviewing = true;
        RaiseStateChanged();
    }

    /// <summary>Returns from the completion preview to answering.</summary>
    public void CancelPreview()
    {
        if (!_isPreviewing)
        {
            return;
        }

        _isPreviewing = false;
        RaiseStateChanged();
    }

    /// <summary>Sets or removes one answer and announces an actual change once.</summary>
    /// <param name="name">The exact answer name.</param>
    /// <param name="value">The new value; absent removes the answer.</param>
    public void SetValue(string name, KajayValue value)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        bool hadPrevious = _answers.TryGetValue(name, out KajayValue previousValue);
        if (value.Kind == KajayValueKind.Absent)
        {
            if (!hadPrevious)
            {
                return;
            }

            _answers.Remove(name);
        }
        else
        {
            if (hadPrevious && previousValue == value)
            {
                return;
            }

            _answers[name] = value;
        }

        ValueChanged?.Invoke(
            this,
            new SurveyValueChangedEventArgs(name, previousValue, value));
    }

    /// <summary>Completes once, publishing data before the state transition.</summary>
    public void Complete()
    {
        if (_isCompleted)
        {
            return;
        }

        _isCompleted = true;
        _isPreviewing = false;
        Completed?.Invoke(this, new SurveyCompletedEventArgs(_answers));
        RaiseStateChanged();
    }

    private SurveyState ResolveState()
    {
        if (_isLoading)
        {
            return SurveyState.Loading;
        }

        if (_isCompleted)
        {
            return SurveyState.Completed;
        }

        if (_isPreviewing)
        {
            return SurveyState.Preview;
        }

        return _hasPages ? SurveyState.Running : SurveyState.Empty;
    }

    private void RaiseStateChanged()
    {
        StateChanged?.Invoke(this, new SurveyStateChangedEventArgs(State));
    }
}
