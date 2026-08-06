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
}
