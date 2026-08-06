namespace Kajay;

/// <summary>Checks authored answer rules against a survey's current data.</summary>
public sealed class SurveyValidation
{
    private readonly Survey _survey;
    private readonly SurveyRuntimeDefinition _definition;
    private readonly SurveyQuestionValidator? _questionValidator;
    private readonly AsyncSurveyQuestionValidator? _asyncQuestionValidator;
    private readonly SurveyServerValidator? _serverValidator;
    private readonly Dictionary<string, IReadOnlyList<SurveyValidationError>> _errors =
        new(StringComparer.Ordinal);

    internal SurveyValidation(
        Survey survey,
        SurveyRuntimeDefinition definition,
        SurveyOptions options)
    {
        _survey = survey;
        _definition = definition;
        _questionValidator = options.QuestionValidator;
        _asyncQuestionValidator = options.AsyncQuestionValidator;
        _serverValidator = options.ServerValidator;
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
            ValidateQuestion(question, errors);
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
        var errors = new List<SurveyValidationError>();
        IsValidating = true;
        try
        {
            var pending = new List<Task<IReadOnlyList<SurveyValidationError>>>();
            if (_asyncQuestionValidator is not null)
            {
                foreach (SurveyRuntimeQuestion question in questions)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    pending.Add(_asyncQuestionValidator(
                        CreateContext(question),
                        cancellationToken).AsTask());
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

            foreach (IReadOnlyList<SurveyValidationError> reported in await Task.WhenAll(
                         pending).ConfigureAwait(false))
            {
                ArgumentNullException.ThrowIfNull(reported);
                errors.AddRange(reported);
            }
        }
        finally
        {
            IsValidating = false;
        }

        SurveyValidationResult result = new(errors.Count == 0, errors.AsReadOnly());
        if (string.Equals(page, _survey.CurrentPageName, StringComparison.Ordinal)
            && DataMatches(data, _survey.Data))
        {
            ApplyErrors(questions, result.Errors);
        }

        return result;
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

    private static bool DataMatches(
        IReadOnlyDictionary<string, KajayValue> left,
        IReadOnlyDictionary<string, KajayValue> right)
    {
        return left.Count == right.Count
            && left.All(pair => right.TryGetValue(pair.Key, out KajayValue value)
                && value == pair.Value);
    }

    private void ValidateQuestion(
        SurveyRuntimeQuestion question,
        List<SurveyValidationError> errors)
    {
        int previousErrorCount = errors.Count;
        KajayValue value = _survey.GetValue(question.ValueKey);
        if (KajayValueSemantics.IsEmpty(value))
        {
            if (_survey.TryGetQuestionState(question.Name, out SurveyQuestionState state)
                && state.IsRequired)
            {
                errors.Add(new SurveyValidationError(
                    question.Name,
                    "required",
                    question.RequiredMessage));
                return;
            }
        }
        else
        {
            foreach (SurveyRuntimeValidator validator in question.Validators)
            {
                if (Fails(validator, value))
                {
                    errors.Add(new SurveyValidationError(
                        question.Name,
                        validator.Type,
                        validator.Message));
                }
            }

            ValidateFile(question, value, errors);
        }

        if (errors.Count == previousErrorCount && _questionValidator is not null)
        {
            IReadOnlyList<SurveyValidationError> reported =
                _questionValidator(CreateContext(question));
            ArgumentNullException.ThrowIfNull(reported);
            errors.AddRange(reported);
        }
    }

    private static void ValidateFile(
        SurveyRuntimeQuestion question,
        KajayValue value,
        List<SurveyValidationError> errors)
    {
        SurveyRuntimeFileSettings? settings = question.FileSettings;
        if (settings is null || value.Kind != KajayValueKind.Array)
        {
            return;
        }

        SurveyFileEntry[] files = value.GetArray()
            .Select(item => SurveyFileEntry.TryFrom(item, out SurveyFileEntry? file) ? file : null)
            .OfType<SurveyFileEntry>()
            .ToArray();
        if (settings.MaximumCount > 0 && files.Length > settings.MaximumCount)
        {
            errors.Add(new SurveyValidationError(question.Name, "filetoomany"));
        }

        foreach (SurveyFileEntry file in files)
        {
            if (settings.AcceptedTypes.Length > 0
                && !MatchesAcceptedType(file, settings.AcceptedTypes))
            {
                errors.Add(new SurveyValidationError(
                    question.Name,
                    "filewrongtype",
                    Path: file.Name));
            }
            if (settings.MaximumSize > 0 && file.Size > settings.MaximumSize)
            {
                errors.Add(new SurveyValidationError(
                    question.Name,
                    "filetoolarge",
                    Path: file.Name));
            }
        }
    }

    private static bool MatchesAcceptedType(SurveyFileEntry file, string acceptedTypes)
    {
        foreach (string token in acceptedTypes.Split(
                     ',',
                     StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (token.Length > 0 && token[0] == '.'
                && file.Name.EndsWith(token, StringComparison.OrdinalIgnoreCase)
                || token.EndsWith("/*", StringComparison.Ordinal)
                && file.MediaType.StartsWith(token[..^1], StringComparison.OrdinalIgnoreCase)
                || string.Equals(token, file.MediaType, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
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
            .Where(question => _survey.TryGetQuestionState(
                question.Name,
                out SurveyQuestionState state) && state.IsReachable)
            .ToArray();
    }

    private SurveyRuntimeQuestion[] AllQuestions()
    {
        return _definition.Pages
            .SelectMany(page => page.Questions)
            .Where(question => _survey.TryGetQuestionState(
                question.Name,
                out SurveyQuestionState state) && state.IsReachable)
            .ToArray();
    }

    private bool Fails(SurveyRuntimeValidator validator, KajayValue value)
    {
        return validator.Type switch
        {
            "numericvalidator" => FailsNumeric(validator, value),
            "textvalidator" => FailsText(validator, value),
            "regexvalidator" => FailsPattern(validator, value),
            "emailvalidator" => FailsEmail(value),
            "expressionvalidator" => FailsExpression(validator),
            "answercountvalidator" => FailsCount(validator, value),
            _ => false,
        };
    }

    private static bool FailsNumeric(SurveyRuntimeValidator validator, KajayValue value)
    {
        return !KajayNumber.TryConvert(value, out double number)
            || validator.Minimum is double minimum && number < minimum
            || validator.Maximum is double maximum && number > maximum;
    }

    private static bool FailsText(SurveyRuntimeValidator validator, KajayValue value)
    {
        if (!KajayText.TryConvert(value, out string text))
        {
            return true;
        }

        return validator.Minimum is double minimum && text.Length < minimum
            || validator.Maximum is double maximum && text.Length > maximum
            || !validator.AllowDigits && text.Any(character => character is >= '0' and <= '9');
    }

    private static bool FailsPattern(SurveyRuntimeValidator validator, KajayValue value)
    {
        return validator.CompiledPattern is not null
            && KajayText.TryConvert(value, out string text)
            && !validator.CompiledPattern.IsMatch(text);
    }

    private static bool FailsEmail(KajayValue value)
    {
        if (!KajayText.TryConvert(value, out string text))
        {
            return true;
        }

        string trimmed = text.Trim();
        int at = trimmed.IndexOf('@', StringComparison.Ordinal);
        int dot = at < 0 ? -1 : trimmed.IndexOf('.', at + 1);
        return at <= 0
            || dot <= at + 1
            || dot == trimmed.Length - 1
            || trimmed.Any(char.IsWhiteSpace)
            || trimmed.LastIndexOf('@') != at;
    }

    private bool FailsExpression(SurveyRuntimeValidator validator)
    {
        if (validator.Expression is null)
        {
            return false;
        }

        ExpressionEvaluationResult result = validator.Expression.Evaluate(
            _survey.CreateExpressionContext());
        return result.Errors.Count == 0 && !KajayValueSemantics.IsTruthy(result.Value);
    }

    private static bool FailsCount(SurveyRuntimeValidator validator, KajayValue value)
    {
        int count = value.Kind == KajayValueKind.Array ? value.GetArray().Count : 1;
        return validator.Minimum is double minimum && count < minimum
            || validator.Maximum is double maximum && count > maximum;
    }
}
