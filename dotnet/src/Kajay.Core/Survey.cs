namespace Kajay;

/// <summary>A mutable, single-owner instance of a parsed survey definition.</summary>
public sealed class Survey
{
    private const int LogicCascadeLimit = 128;
    private readonly int _pageCount;
    private readonly SurveyRuntimeDefinition _definition;
    private readonly Dictionary<string, KajayValue> _answers = new(StringComparer.Ordinal);
    private readonly SurveyCalculatedValues _calculatedValues;
    private readonly SurveyTriggers _triggers;
    private readonly TimeProvider _timeProvider;
    private readonly ExpressionFunctionRegistry _expressionFunctions;
    private bool _isLoading;
    private bool _isPreviewing;
    private bool _isCompleted;
    private int _currentPageIndex;

    internal Survey(
        SurveyRuntimeDefinition definition,
        TimeProvider timeProvider,
        ExpressionFunctionRegistry expressionFunctions)
    {
        _definition = definition;
        _pageCount = definition.PageCount;
        _timeProvider = timeProvider;
        _expressionFunctions = expressionFunctions;
        Validation = new SurveyValidation(this, definition);
        Timer = new SurveyTimer(
            this,
            timeProvider,
            definition.SurveyTimeLimit,
            definition.DefaultPageTimeLimit,
            definition.PageTimeLimits);
        _calculatedValues = new SurveyCalculatedValues(this, definition.CalculatedValues);
        _calculatedValues.SettleAll();
        _triggers = new SurveyTriggers(this, definition.Triggers);
        _triggers.Establish();
    }

    /// <summary>Gets the current lifecycle state.</summary>
    public SurveyState State => ResolveState();

    /// <summary>Gets whether this survey has completed.</summary>
    public bool IsCompleted => _isCompleted;

    /// <summary>Gets the deterministic clocks owned by this survey.</summary>
    public SurveyTimer Timer { get; }

    /// <summary>Gets the authored answer-rule checks for this survey.</summary>
    public SurveyValidation Validation { get; }

    /// <summary>Gets the number of effective pages.</summary>
    public int PageCount => _pageCount;

    /// <summary>Gets the zero-based current effective page index.</summary>
    public int CurrentPageIndex => _currentPageIndex;

    /// <summary>Gets the current page name, or an empty string when no page exists.</summary>
    public string CurrentPageName => _pageCount == 0
        ? string.Empty
        : _definition.Pages[_currentPageIndex].Name;

    /// <summary>Gets whether the respondent is on the first effective page.</summary>
    public bool IsFirstPage => _currentPageIndex == 0;

    /// <summary>Gets whether the respondent is on the last effective page.</summary>
    public bool IsLastPage => _pageCount == 0 || _currentPageIndex >= _pageCount - 1;

    /// <summary>Gets the respondent's effective page progress.</summary>
    public SurveyPageProgress PageProgress => _pageCount == 0
        ? new SurveyPageProgress(0, 0, 0)
        : new SurveyPageProgress(
            _currentPageIndex + 1,
            _pageCount,
            (double)(_currentPageIndex + 1) / _pageCount);

    /// <summary>Raised after a lifecycle transition is committed.</summary>
    public event EventHandler<SurveyStateChangedEventArgs>? StateChanged;

    /// <summary>Raised after an answer changes.</summary>
    public event EventHandler<SurveyValueChangedEventArgs>? ValueChanged;

    /// <summary>Raised once with the submitted answer snapshot.</summary>
    public event EventHandler<SurveyCompletedEventArgs>? Completed;

    /// <summary>Raised after the current effective page changes.</summary>
    public event EventHandler<SurveyCurrentPageChangedEventArgs>? CurrentPageChanged;

    /// <summary>Gets an immutable snapshot of answers and included calculated values.</summary>
    public IReadOnlyDictionary<string, KajayValue> Data
    {
        get
        {
            var data = new Dictionary<string, KajayValue>(_answers, StringComparer.Ordinal);
            _calculatedValues.CopyIncludedTo(data);
            return new System.Collections.ObjectModel.ReadOnlyDictionary<string, KajayValue>(data);
        }
    }

    /// <summary>Gets an answer, or otherwise a calculated value, by exact name.</summary>
    /// <param name="name">The exact ordinal value name.</param>
    /// <param name="value">The resolved value when present.</param>
    /// <returns>True when an answer or calculated value exists.</returns>
    public bool TryGetValue(string name, out KajayValue value)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _answers.TryGetValue(name, out value)
            || _calculatedValues.TryGetValue(name, out value);
    }

    /// <summary>Gets a calculated value without falling back to an answer of the same name.</summary>
    /// <param name="name">The exact ordinal calculated-value name.</param>
    /// <param name="value">The current calculated value when present.</param>
    /// <returns>True when the named calculated value has a result.</returns>
    public bool TryGetCalculatedValue(string name, out KajayValue value)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _calculatedValues.TryGetValue(name, out value);
    }

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
        List<SurveyValueChangedEventArgs> changes = [];
        if (!WriteValue(name, value, changes))
        {
            return;
        }

        SettleLogic([ExpressionPath.FromName(name)], changes);
        foreach (SurveyValueChangedEventArgs change in changes)
        {
            ValueChanged?.Invoke(this, change);
        }
    }

    internal bool WriteValue(
        string name,
        KajayValue value,
        ICollection<SurveyValueChangedEventArgs> changes)
    {
        bool hadPrevious = _answers.TryGetValue(name, out KajayValue previousValue);
        if (value.Kind == KajayValueKind.Absent)
        {
            if (!hadPrevious)
            {
                return false;
            }

            _answers.Remove(name);
        }
        else
        {
            if (hadPrevious && previousValue == value)
            {
                return false;
            }

            _answers[name] = value;
        }

        changes.Add(new SurveyValueChangedEventArgs(name, previousValue, value));
        return true;
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
        Timer.Stop();
        Completed?.Invoke(this, new SurveyCompletedEventArgs(Data));
        RaiseStateChanged();
    }

    /// <summary>Measures marks earned by the current reachable quiz questions.</summary>
    /// <returns>The current score without changing survey state.</returns>
    public QuizScore GetQuizScore()
    {
        return QuizScorer.Score(this, _definition);
    }

    /// <summary>
    /// Runs the cancellation-aware forward gate, then moves or completes when allowed.
    /// </summary>
    /// <param name="cancellationToken">Cancels pending validation or host work.</param>
    /// <returns>The committed navigation outcome.</returns>
    public Task<SurveyAdvanceOutcome> AdvanceAsync(
        CancellationToken cancellationToken = default)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return Task.FromCanceled<SurveyAdvanceOutcome>(cancellationToken);
        }
        if (_isCompleted)
        {
            return Task.FromResult(SurveyAdvanceOutcome.NoChange);
        }

        if (IsLastPage)
        {
            Complete();
        }
        else
        {
            SetCurrentPageIndex(_currentPageIndex + 1);
        }

        return Task.FromResult(SurveyAdvanceOutcome.Advanced);
    }

    /// <summary>Moves to the preceding effective page without running the forward gate.</summary>
    /// <returns>True when the current page changed.</returns>
    public bool MovePrevious()
    {
        return !_isCompleted && SetCurrentPageIndex(_currentPageIndex - 1);
    }

    /// <summary>Moves directly to an effective page by its authored name.</summary>
    /// <param name="pageName">The exact ordinal page name.</param>
    /// <returns>True when the current page changed.</returns>
    public bool GoToPage(string pageName)
    {
        ArgumentNullException.ThrowIfNull(pageName);
        if (_isCompleted)
        {
            return false;
        }

        for (int index = 0; index < _definition.Pages.Count; index += 1)
        {
            if (string.Equals(
                _definition.Pages[index].Name,
                pageName,
                StringComparison.Ordinal))
            {
                return SetCurrentPageIndex(index);
            }
        }

        return false;
    }

    internal bool GoToPageOrQuestion(string name)
    {
        if (GoToPage(name))
        {
            return true;
        }

        for (int index = 0; index < _definition.Pages.Count; index += 1)
        {
            if (_definition.Pages[index].ContainsQuestion(name))
            {
                return SetCurrentPageIndex(index);
            }
        }

        return false;
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

        return _pageCount > 0 ? SurveyState.Running : SurveyState.Empty;
    }

    internal KajayValue GetValue(string name)
    {
        return TryGetValue(name, out KajayValue value) ? value : KajayValue.Absent;
    }

    internal ExpressionEvaluationContext CreateExpressionContext()
    {
        var values = new Dictionary<string, KajayValue>(_answers, StringComparer.Ordinal);
        foreach (SurveyRuntimeCalculatedValue definition in _definition.CalculatedValues)
        {
            if (!values.ContainsKey(definition.Name)
                && _calculatedValues.TryGetValue(definition.Name, out KajayValue value))
            {
                values.Add(definition.Name, value);
            }
        }

        return new ExpressionEvaluationContext(
            _timeProvider.GetUtcNow(),
            values,
            _expressionFunctions);
    }

    private void SettleLogic(
        IReadOnlyList<ExpressionPath> initialChanges,
        ICollection<SurveyValueChangedEventArgs> changes)
    {
        IReadOnlyList<ExpressionPath> pending = initialChanges;
        for (int cascade = 0; cascade < LogicCascadeLimit; cascade += 1)
        {
            IReadOnlyList<ExpressionPath> calculatedWrites =
                _calculatedValues.Recalculate(pending, changes);
            ExpressionPath[] triggerInputs = [.. pending, .. calculatedWrites];
            IReadOnlyList<ExpressionPath> triggerWrites =
                _triggers.Settle(triggerInputs, changes);
            if (triggerWrites.Count == 0)
            {
                return;
            }

            pending = triggerWrites;
        }
    }

    internal void AdvanceFromTimer()
    {
        if (_currentPageIndex + 1 < _pageCount)
        {
            SetCurrentPageIndex(_currentPageIndex + 1);
            return;
        }

        Complete();
    }

    private void RaiseStateChanged()
    {
        StateChanged?.Invoke(this, new SurveyStateChangedEventArgs(State));
    }

    private bool SetCurrentPageIndex(int pageIndex)
    {
        if (pageIndex < 0 || pageIndex >= _pageCount || pageIndex == _currentPageIndex)
        {
            return false;
        }

        int previousPageIndex = _currentPageIndex;
        _currentPageIndex = pageIndex;
        Timer.RestartPage();
        CurrentPageChanged?.Invoke(
            this,
            new SurveyCurrentPageChangedEventArgs(previousPageIndex, pageIndex));
        return true;
    }
}
