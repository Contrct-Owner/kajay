namespace Kajay.Validation;

/// <summary>Checks authored answer rules against a survey's current data.</summary>
public sealed class SurveyValidation
{
    private readonly Survey _survey;
    private readonly SurveyRuntimeDefinition _definition;
    private readonly AsyncSurveyQuestionValidator? _asyncQuestionValidator;
    private readonly SurveyServerValidator? _serverValidator;
    private readonly SurveyQuestionValidationPipeline _questionValidation;
    private readonly Dictionary<string, IReadOnlyList<SurveyValidationError>> _errors =
        new(StringComparer.Ordinal);

    internal SurveyValidation(
        Survey survey, SurveyRuntimeDefinition definition, SurveyOptions options)
    {
        _survey = survey;
        _definition = definition;
        _asyncQuestionValidator = options.AsyncQuestionValidator;
        _serverValidator = options.ServerValidator;
        _questionValidation = new SurveyQuestionValidationPipeline(
            survey, options.QuestionValidator);
    }

    /// <summary>Gets whether asynchronous host validation is currently outstanding.</summary>
    public bool IsValidating { get; private set; }

    /// <summary>Gets whether authored and host validation are enabled.</summary>
    public bool IsEnabled => _definition.ValidationEnabled;

    /// <summary>Gets when forward navigation applies the validation gate.</summary>
    public SurveyValidationMode Mode => _definition.ValidationMode;

    /// <summary>Gets every currently retained validation error in definition order.</summary>
    public IReadOnlyList<SurveyValidationError> Errors =>
        Array.AsReadOnly(GetOrderedErrors());

    /// <summary>Raised after the retained validation-error snapshot changes.</summary>
    public event EventHandler<SurveyValidationErrorsChangedEventArgs>? ErrorsChanged;

    /// <summary>Gets the retained errors for one exact question name.</summary>
    /// <param name="questionName">The authored question name.</param>
    /// <returns>A stable snapshot, or an empty list when the question has no errors.</returns>
    public IReadOnlyList<SurveyValidationError> GetErrors(string questionName)
    {
        ArgumentNullException.ThrowIfNull(questionName);
        return _errors.TryGetValue(questionName, out IReadOnlyList<SurveyValidationError>? errors)
            ? errors
            : Array.Empty<SurveyValidationError>();
    }

    /// <summary>Checks the questions on the current page.</summary>
    /// <returns>Whether the page passed and each failed rule in definition order.</returns>
    public SurveyValidationResult ValidateCurrentPage()
    {
        return IsEnabled
            ? Validate(CurrentQuestions())
            : new SurveyValidationResult(true, []);
    }

    /// <summary>Runs synchronous rules, then asynchronous question and server checks.</summary>
    /// <param name="cancellationToken">Cancels pending host work.</param>
    /// <returns>Whether the current page passed and every reported error.</returns>
    public async ValueTask<SurveyValidationResult> ValidateCurrentPageAsync(
        CancellationToken cancellationToken = default)
    {
        return await ValidateAsync(
            IsEnabled ? CurrentQuestions() : [],
            cancellationToken).ConfigureAwait(false);
    }

    internal ValueTask<SurveyValidationResult> ValidateAdvanceAsync(
        bool isLastPage,
        CancellationToken cancellationToken)
    {
        SurveyRuntimeQuestion[] questions = !IsEnabled
            || Mode == SurveyValidationMode.OnComplete && !isLastPage
                ? []
                : Mode == SurveyValidationMode.OnComplete
                    ? AllQuestions()
                    : CurrentQuestions();
        return ValidateAsync(questions, cancellationToken);
    }

    internal void RevalidateChangedValues(IEnumerable<string> valueNames)
    {
        RemoveUnreachableErrors();
        if (!IsEnabled || Mode != SurveyValidationMode.OnValueChanged)
        {
            return;
        }

        HashSet<string> changed = valueNames.ToHashSet(StringComparer.Ordinal);
        SurveyRuntimeQuestion[] questions = CurrentQuestions()
            .Where(question => changed.Contains(question.ValueKey))
            .ToArray();
        if (questions.Length > 0)
        {
            Validate(questions);
        }
    }

    private SurveyValidationResult Validate(SurveyRuntimeQuestion[] questions)
    {
        var errors = new List<SurveyValidationError>();
        foreach (SurveyRuntimeQuestion question in questions)
        {
            _questionValidation.Validate(question, errors);
        }

        SurveyValidationResult result = new(errors.Count == 0, errors.AsReadOnly());
        ApplyErrors(questions, result.Errors);
        return result;
    }

    private async ValueTask<SurveyValidationResult> ValidateAsync(
        SurveyRuntimeQuestion[] questions,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (IsValidating)
        {
            throw new InvalidOperationException("Survey validation is already in progress.");
        }

        SurveyValidationResult synchronous = Validate(questions);
        if (!synchronous.IsValid
            || questions.Length == 0
            || _asyncQuestionValidator is null && _serverValidator is null)
        {
            return synchronous;
        }

        string page = _survey.CurrentPageName;
        IReadOnlyDictionary<string, KajayValue> data = _survey.Data;
        IsValidating = true;
        try
        {
            IReadOnlyList<SurveyValidationError> errors = await RunHostValidationAsync(
                questions, data, cancellationToken).ConfigureAwait(false);
            SurveyValidationResult result = new(errors.Count == 0, errors);
            if (string.Equals(page, _survey.CurrentPageName, StringComparison.Ordinal)
                && SurveyValidationSnapshot.Matches(data, _survey.Data))
            {
                ApplyErrors(questions, result.Errors);
            }

            return result;
        }
        finally
        {
            IsValidating = false;
        }
    }

    private async ValueTask<IReadOnlyList<SurveyValidationError>> RunHostValidationAsync(
        SurveyRuntimeQuestion[] questions,
        IReadOnlyDictionary<string, KajayValue> data,
        CancellationToken cancellationToken)
    {
        var pending = new List<Task<IReadOnlyList<SurveyValidationError>>>();
        if (_asyncQuestionValidator is not null)
        {
            foreach (SurveyRuntimeQuestion question in questions)
            {
                cancellationToken.ThrowIfCancellationRequested();
                pending.Add(_asyncQuestionValidator(
                    CreateContext(question), cancellationToken).AsTask());
            }
        }
        if (_serverValidator is not null)
        {
            cancellationToken.ThrowIfCancellationRequested();
            pending.Add(_serverValidator(
                new SurveyServerValidationContext(
                    data,
                    Array.AsReadOnly(questions.Select(question => question.Name).ToArray())),
                cancellationToken).AsTask());
        }

        var errors = new List<SurveyValidationError>();
        foreach (IReadOnlyList<SurveyValidationError> reported in await Task.WhenAll(
                     pending).ConfigureAwait(false))
        {
            ArgumentNullException.ThrowIfNull(reported);
            errors.AddRange(reported);
        }
        return errors.AsReadOnly();
    }

    private void ApplyErrors(
        IReadOnlyList<SurveyRuntimeQuestion> questions,
        IReadOnlyList<SurveyValidationError> errors)
    {
        SurveyValidationError[] before = GetOrderedErrors();
        foreach (SurveyRuntimeQuestion question in questions)
        {
            _errors.Remove(question.Name);
        }
        foreach (IGrouping<string, SurveyValidationError> group in errors.GroupBy(
                     error => error.Name,
                     StringComparer.Ordinal))
        {
            _errors[group.Key] = Array.AsReadOnly(group.ToArray());
        }

        RaiseErrorsChanged(before);
    }

    private void RemoveUnreachableErrors()
    {
        SurveyValidationError[] before = GetOrderedErrors();
        foreach (string name in _errors.Keys.ToArray())
        {
            if (!_survey.TryGetQuestionState(name, out SurveyQuestionState state)
                || !state.IsReachable)
            {
                _errors.Remove(name);
            }
        }

        RaiseErrorsChanged(before);
    }

    private void RaiseErrorsChanged(IReadOnlyList<SurveyValidationError> before)
    {
        SurveyValidationError[] after = GetOrderedErrors();
        if (!before.SequenceEqual(after))
        {
            ErrorsChanged?.Invoke(
                this,
                new SurveyValidationErrorsChangedEventArgs(Array.AsReadOnly(after)));
        }
    }

    private SurveyValidationError[] GetOrderedErrors()
    {
        var ordered = new List<SurveyValidationError>();
        var emitted = new HashSet<string>(StringComparer.Ordinal);
        foreach (SurveyRuntimeQuestion question in _definition.Pages.SelectMany(
                     page => page.Questions))
        {
            if (emitted.Add(question.Name)
                && _errors.TryGetValue(
                    question.Name,
                    out IReadOnlyList<SurveyValidationError>? errors))
            {
                ordered.AddRange(errors);
            }
        }
        foreach ((string name, IReadOnlyList<SurveyValidationError> errors) in _errors)
        {
            if (emitted.Add(name))
            {
                ordered.AddRange(errors);
            }
        }

        return ordered.ToArray();
    }

    private SurveyQuestionValidationContext CreateContext(SurveyRuntimeQuestion question)
    {
        return new SurveyQuestionValidationContext(
            question.Name,
            question.ValueKey,
            _survey.GetValue(question.ValueKey),
            _survey.Data);
    }

    private SurveyRuntimeQuestion[] CurrentQuestions()
    {
        if (_survey.State != SurveyState.Running
            || _survey.CurrentAuthoredPageIndex < 0)
        {
            return [];
        }

        return _definition.Pages[_survey.CurrentAuthoredPageIndex].Questions
            .Where(IsReachable)
            .ToArray();
    }

    private SurveyRuntimeQuestion[] AllQuestions()
    {
        return _definition.Pages
            .SelectMany(page => page.Questions)
            .Where(IsReachable)
            .ToArray();
    }

    private bool IsReachable(SurveyRuntimeQuestion question)
    {
        return _survey.TryGetQuestionState(
            question.Name,
            out SurveyQuestionState state) && state.IsReachable;
    }

}
