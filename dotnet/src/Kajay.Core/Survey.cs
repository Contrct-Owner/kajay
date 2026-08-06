namespace Kajay;

/// <summary>A mutable, single-owner instance of a parsed survey definition.</summary>
public sealed partial class Survey
{
    private const int LogicCascadeLimit = 128;
    private readonly SurveyRuntimeDefinition _definition;
    private readonly Dictionary<string, KajayValue> _answers = new(StringComparer.Ordinal);
    private readonly SurveyCalculatedValues _calculatedValues;
    private readonly SurveyConditions _conditions;
    private readonly SurveyTriggers _triggers;
    private readonly TimeProvider _timeProvider;
    private readonly ExpressionFunctionRegistry _expressionFunctions;
    private readonly SurveyAsyncFunctionValues _asyncFunctionValues;
    private readonly SurveyChoiceSources _choiceSources;
    private readonly SurveyFileAdapters _fileAdapters;
    private readonly SurveyLogicErrors _logicErrors = new();
    private readonly IReadOnlyDictionary<string, SurveyQuestion> _questionsByName;
    private bool _isLoading;
    private bool _isPreviewing;
    private bool _isCompleted;
    private int _currentPageIndex;
    private int[] _visiblePageIndexes = [];

    internal Survey(
        SurveyRuntimeDefinition definition,
        TimeProvider timeProvider,
        SurveyOptions options)
    {
        _definition = definition;
        _locale = definition.Locale;
        _timeProvider = timeProvider;
        _expressionFunctions = options.ExpressionFunctions;
        _asyncFunctionValues = new SurveyAsyncFunctionValues(_expressionFunctions);
        _fileAdapters = new SurveyFileAdapters(options);
        Validation = new SurveyValidation(this, definition, options);
        Timer = new SurveyTimer(
            this,
            timeProvider,
            definition.SurveyTimeLimit,
            definition.DefaultPageTimeLimit,
            definition.PageTimeLimits);
        _calculatedValues = new SurveyCalculatedValues(this, definition.CalculatedValues);
        _calculatedValues.SettleAll();
        _conditions = new SurveyConditions(this, definition);
        _conditions.Establish();
        _visiblePageIndexes = _conditions.GetVisiblePageIndexes();
        SurveyQuestion[] questions = definition.Pages
            .SelectMany(page => page.Questions)
            .Select(CreateQuestion)
            .ToArray();
        Questions = Array.AsReadOnly(questions);
        _questionsByName = new System.Collections.ObjectModel.ReadOnlyDictionary<string, SurveyQuestion>(
            questions.GroupBy(question => question.Name, StringComparer.Ordinal)
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal));
        _choiceSources = new SurveyChoiceSources(
            this,
            options,
            Array.AsReadOnly(questions.OfType<SurveyChoiceQuestion>().ToArray()));
        _choiceSources.SettleSynchronous();
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

    /// <summary>Gets every authored question in definition order.</summary>
    public IReadOnlyList<SurveyQuestion> Questions { get; }

    /// <summary>Gets the number of effective pages.</summary>
    public int PageCount => _visiblePageIndexes.Length;

    /// <summary>Gets the zero-based current effective page index.</summary>
    public int CurrentPageIndex => _currentPageIndex;

    internal int CurrentAuthoredPageIndex => PageCount == 0
        ? -1
        : _visiblePageIndexes[_currentPageIndex];

    /// <summary>Gets the current page name, or an empty string when no page exists.</summary>
    public string CurrentPageName => PageCount == 0
        ? string.Empty
        : _definition.Pages[_visiblePageIndexes[_currentPageIndex]].Name;

    /// <summary>Gets whether the respondent is on the first effective page.</summary>
    public bool IsFirstPage => _currentPageIndex == 0;

    /// <summary>Gets whether the respondent is on the last effective page.</summary>
    public bool IsLastPage => PageCount == 0 || _currentPageIndex >= PageCount - 1;

    /// <summary>Gets the respondent's effective page progress.</summary>
    public SurveyPageProgress PageProgress => PageCount == 0
        ? new SurveyPageProgress(0, 0, 0)
        : new SurveyPageProgress(
            _currentPageIndex + 1,
            PageCount,
            (double)(_currentPageIndex + 1) / PageCount);

    /// <summary>Raised after a lifecycle transition is committed.</summary>
    public event EventHandler<SurveyStateChangedEventArgs>? StateChanged;

    /// <summary>Raised after an answer changes.</summary>
    public event EventHandler<SurveyValueChangedEventArgs>? ValueChanged;

    /// <summary>Raised once with the submitted answer snapshot.</summary>
    public event EventHandler<SurveyCompletedEventArgs>? Completed;

    /// <summary>Raised after the current effective page changes.</summary>
    public event EventHandler<SurveyCurrentPageChangedEventArgs>? CurrentPageChanged;

    /// <summary>Raised after expression-derived element states finish settling.</summary>
    public event EventHandler<SurveyElementStateChangedEventArgs>? ElementStateChanged;

    /// <summary>Gets whether asynchronous expression functions are being settled.</summary>
    public bool IsSettling { get; private set; }

    /// <summary>Gets expression errors reported by the most recent logic settlement.</summary>
    public IReadOnlyList<ExpressionError> LogicErrors => _logicErrors.Current;

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

    /// <summary>Gets a headless question by its exact authored name.</summary>
    /// <param name="name">The exact ordinal question name.</param>
    /// <returns>The bound question, or null when no question has that name.</returns>
    public SurveyQuestion? GetQuestion(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _questionsByName.GetValueOrDefault(name);
    }

    /// <summary>Reports whether the named authored page is currently effective.</summary>
    /// <param name="pageName">The exact ordinal page name.</param>
    /// <returns>True only when a matching page exists and its condition is visible.</returns>
    public bool IsPageVisible(string pageName)
    {
        ArgumentNullException.ThrowIfNull(pageName);
        for (int index = 0; index < _definition.Pages.Count; index += 1)
        {
            if (string.Equals(_definition.Pages[index].Name, pageName, StringComparison.Ordinal))
            {
                return _conditions.IsPageVisible(index);
            }
        }

        return false;
    }

    /// <summary>Gets the current computed state for a named question.</summary>
    /// <param name="questionName">The exact ordinal question name.</param>
    /// <param name="questionState">The computed state when the question exists.</param>
    /// <returns>True when a matching question exists.</returns>
    public bool TryGetQuestionState(
        string questionName,
        out SurveyQuestionState questionState)
    {
        ArgumentNullException.ThrowIfNull(questionName);
        return _conditions.TryGetQuestionState(questionName, out questionState);
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
        SurveyState previousState = State;
        List<SurveyValueChangedEventArgs> changes = [];
        List<SurveyElementStateChangedEventArgs> stateChanges = [];
        if (!WriteValue(name, value, changes))
        {
            return;
        }

        _logicErrors.Reset();
        SettleLogic([ExpressionPath.FromName(name)], changes, stateChanges);
        _choiceSources.SettleSynchronous();
        Validation.RevalidateChangedValues(changes.Select(change => change.Name));
        foreach (SurveyValueChangedEventArgs change in changes)
        {
            ValueChanged?.Invoke(this, change);
        }
        foreach (SurveyElementStateChangedEventArgs change in stateChanges)
        {
            ElementStateChanged?.Invoke(this, change);
        }
        if (State != previousState && State is SurveyState.Empty or SurveyState.Running)
        {
            RaiseStateChanged();
        }
    }

    /// <summary>Sets an answer, then awaits every newly reachable asynchronous function.</summary>
    public async Task SetValueAsync(
        string name,
        KajayValue value,
        CancellationToken cancellationToken = default)
    {
        SetValue(name, value);
        await SettleAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Runs asynchronous expression functions to a deterministic fixed point.</summary>
    public async Task SettleAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (IsSettling)
        {
            throw new InvalidOperationException("Survey expression settlement is already in progress.");
        }

        IsSettling = true;
        _logicErrors.Reset();
        try
        {
            for (int pass = 0; pass < LogicCascadeLimit; pass += 1)
            {
                _asyncFunctionValues.Begin(_timeProvider.GetUtcNow(), cancellationToken);
                SettleAllLogic();
                Task<bool> expressions = _asyncFunctionValues.ResolvePendingAsync();
                Task<bool> choices = _choiceSources.SettleAsync(cancellationToken);
                await Task.WhenAll(expressions, choices).ConfigureAwait(false);
                if (!expressions.Result && !choices.Result)
                {
                    return;
                }
            }

            throw new InvalidOperationException("Asynchronous expression settlement did not converge.");
        }
        finally
        {
            IsSettling = false;
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
    public async Task<SurveyAdvanceOutcome> AdvanceAsync(
        CancellationToken cancellationToken = default)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return await Task.FromCanceled<SurveyAdvanceOutcome>(
                cancellationToken).ConfigureAwait(false);
        }
        if (State != SurveyState.Running)
        {
            return SurveyAdvanceOutcome.NoChange;
        }

        string page = CurrentPageName;
        IReadOnlyDictionary<string, KajayValue> data = Data;
        SurveyValidationResult validation = await Validation.ValidateAdvanceAsync(
            IsLastPage,
            cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        if (!string.Equals(page, CurrentPageName, StringComparison.Ordinal)
            || !DataMatches(data, Data))
        {
            return SurveyAdvanceOutcome.NoChange;
        }
        if (!validation.IsValid)
        {
            return SurveyAdvanceOutcome.Blocked;
        }

        if (IsLastPage)
        {
            Complete();
        }
        else
        {
            SetCurrentPageIndex(_currentPageIndex + 1);
        }

        return SurveyAdvanceOutcome.Advanced;
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

        for (int index = 0; index < _visiblePageIndexes.Length; index += 1)
        {
            int authoredIndex = _visiblePageIndexes[index];
            if (string.Equals(
                _definition.Pages[authoredIndex].Name,
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

        for (int index = 0; index < _visiblePageIndexes.Length; index += 1)
        {
            if (_definition.Pages[_visiblePageIndexes[index]].ContainsQuestion(name))
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

        return PageCount > 0 ? SurveyState.Running : SurveyState.Empty;
    }

    internal KajayValue GetValue(string name)
    {
        return TryGetValue(name, out KajayValue value) ? value : KajayValue.Absent;
    }

    internal SurveyFileAdapters FileAdapters => _fileAdapters;

    internal void RecordLogicErrors(IReadOnlyList<ExpressionError> errors)
    {
        _logicErrors.Record(errors);
    }

    internal KajayValue ResolveValuePath(string raw)
    {
        List<ExpressionError> errors = [];
        ExpressionPath path = ExpressionPath.Parse(raw, new TextSpan(0, raw.Length), errors);
        if (errors.Count > 0 || path.Segments.Count == 0 || path.Segments[0].IsIndex)
        {
            return KajayValue.Absent;
        }

        KajayValue value = GetValue(path.Segments[0].Name!);
        foreach (ExpressionPathSegment segment in path.Segments.Skip(1))
        {
            if (segment.IsIndex)
            {
                if (value.Kind != KajayValueKind.Array
                    || segment.Index >= value.GetArray().Count)
                {
                    return KajayValue.Absent;
                }

                value = value.GetArray()[segment.Index];
            }
            else if (value.Kind != KajayValueKind.Map
                || !value.GetObject().TryGetValue(segment.Name!, out value))
            {
                return KajayValue.Absent;
            }
        }

        return value;
    }

    internal bool IsAuthoredPageVisible(int pageIndex)
    {
        return _conditions.IsPageVisible(pageIndex);
    }

    internal ExpressionEvaluationContext CreateExpressionContext()
    {
        return CreateExpressionContext([]);
    }

    internal ExpressionEvaluationContext CreateExpressionContext(
        IEnumerable<KeyValuePair<string, KajayValue>> additionalValues)
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

        foreach ((string name, KajayValue value) in additionalValues)
        {
            values[name] = value;
        }

        return new ExpressionEvaluationContext(
            _timeProvider.GetUtcNow(),
            values,
            _expressionFunctions,
            _asyncFunctionValues);
    }

    private void SettleAllLogic()
    {
        List<SurveyValueChangedEventArgs> changes = [];
        List<SurveyElementStateChangedEventArgs> stateChanges = [];
        IReadOnlyList<ExpressionPath> calculatedWrites = _calculatedValues.SettleAll(changes);
        _conditions.Establish(stateChanges);
        _visiblePageIndexes = _conditions.GetVisiblePageIndexes();
        IReadOnlyList<ExpressionPath> triggerWrites = _triggers.SettleAll(changes);
        if (calculatedWrites.Count > 0 || triggerWrites.Count > 0)
        {
            SettleLogic([.. calculatedWrites, .. triggerWrites], changes, stateChanges);
        }
        _choiceSources.SettleSynchronous();

        foreach (SurveyValueChangedEventArgs change in changes)
        {
            ValueChanged?.Invoke(this, change);
        }
        foreach (SurveyElementStateChangedEventArgs change in stateChanges)
        {
            ElementStateChanged?.Invoke(this, change);
        }
    }

    private void SettleLogic(
        IReadOnlyList<ExpressionPath> initialChanges,
        ICollection<SurveyValueChangedEventArgs> changes,
        ICollection<SurveyElementStateChangedEventArgs> stateChanges)
    {
        IReadOnlyList<ExpressionPath> pending = initialChanges;
        for (int cascade = 0; cascade < LogicCascadeLimit; cascade += 1)
        {
            IReadOnlyList<ExpressionPath> calculatedWrites =
                _calculatedValues.Recalculate(pending, changes);
            ExpressionPath[] triggerInputs = [.. pending, .. calculatedWrites];
            _conditions.Settle(triggerInputs, stateChanges);
            _visiblePageIndexes = _conditions.GetVisiblePageIndexes();
            IReadOnlyList<ExpressionPath> triggerWrites =
                _triggers.Settle(triggerInputs, changes);
            if (triggerWrites.Count == 0)
            {
                break;
            }

            pending = triggerWrites;
        }

        ClampCurrentPage();
    }

    internal void AdvanceFromTimer()
    {
        if (_currentPageIndex + 1 < PageCount)
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
        if (pageIndex < 0 || pageIndex >= PageCount || pageIndex == _currentPageIndex)
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

    private void ClampCurrentPage()
    {
        if (PageCount > 0 && _currentPageIndex >= PageCount)
        {
            _ = SetCurrentPageIndex(PageCount - 1);
        }
    }

    private static bool DataMatches(
        IReadOnlyDictionary<string, KajayValue> expected,
        IReadOnlyDictionary<string, KajayValue> actual)
    {
        return expected.Count == actual.Count
            && expected.All(entry => actual.TryGetValue(entry.Key, out KajayValue value)
                && value == entry.Value);
    }

    private SurveyQuestion CreateQuestion(SurveyRuntimeQuestion definition)
    {
        return definition.Type switch
        {
            "checkbox" or "dropdown" or "imagepicker" or "radiogroup" or "ranking"
                or "tagbox" => new SurveyChoiceQuestion(this, definition),
            "matrix" or "matrixcells" => new SurveyMatrixQuestion(this, definition),
            "matrixdynamic" or "paneldynamic" => new SurveyRecordQuestion(this, definition),
            "file" => new SurveyFileQuestion(this, definition),
            "signaturepad" => new SurveySignatureQuestion(this, definition),
            _ => new SurveyScalarQuestion(this, definition),
        };
    }
}
