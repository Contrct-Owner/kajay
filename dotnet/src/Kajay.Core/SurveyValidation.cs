namespace Kajay;

/// <summary>Checks authored answer rules against a survey's current data.</summary>
public sealed class SurveyValidation
{
    private readonly Survey _survey;
    private readonly SurveyRuntimeDefinition _definition;
    private readonly SurveyQuestionValidator? _questionValidator;
    private readonly AsyncSurveyQuestionValidator? _asyncQuestionValidator;
    private readonly SurveyServerValidator? _serverValidator;

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

    /// <summary>Checks the questions on the current page.</summary>
    /// <returns>Whether the page passed and each failed rule in definition order.</returns>
    public SurveyValidationResult ValidateCurrentPage()
    {
        SurveyRuntimeQuestion[] questions = CurrentQuestions();
        if (questions.Length == 0)
        {
            return new SurveyValidationResult(true, []);
        }

        var errors = new List<SurveyValidationError>();
        foreach (SurveyRuntimeQuestion question in questions)
        {
            ValidateQuestion(question, errors);
        }

        return new SurveyValidationResult(errors.Count == 0, errors.AsReadOnly());
    }

    /// <summary>Runs synchronous rules, then asynchronous question and server checks.</summary>
    /// <param name="cancellationToken">Cancels pending host work.</param>
    /// <returns>Whether the current page passed and every reported error.</returns>
    public async ValueTask<SurveyValidationResult> ValidateCurrentPageAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (IsValidating)
        {
            throw new InvalidOperationException("Survey validation is already in progress.");
        }

        SurveyValidationResult synchronous = ValidateCurrentPage();
        if (!synchronous.IsValid
            || _asyncQuestionValidator is null && _serverValidator is null)
        {
            return synchronous;
        }

        SurveyRuntimeQuestion[] questions = CurrentQuestions();
        var errors = new List<SurveyValidationError>();
        IsValidating = true;
        try
        {
            if (_asyncQuestionValidator is not null)
            {
                foreach (SurveyRuntimeQuestion question in questions)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    IReadOnlyList<SurveyValidationError> reported =
                        await _asyncQuestionValidator(
                            CreateContext(question),
                            cancellationToken).ConfigureAwait(false);
                    ArgumentNullException.ThrowIfNull(reported);
                    errors.AddRange(reported);
                }
            }

            if (_serverValidator is not null)
            {
                cancellationToken.ThrowIfCancellationRequested();
                IReadOnlyList<SurveyValidationError> reported = await _serverValidator(
                    _survey.Data,
                    cancellationToken).ConfigureAwait(false);
                ArgumentNullException.ThrowIfNull(reported);
                errors.AddRange(reported);
            }
        }
        finally
        {
            IsValidating = false;
        }

        return new SurveyValidationResult(errors.Count == 0, errors.AsReadOnly());
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
        }

        if (errors.Count == previousErrorCount && _questionValidator is not null)
        {
            IReadOnlyList<SurveyValidationError> reported =
                _questionValidator(CreateContext(question));
            ArgumentNullException.ThrowIfNull(reported);
            errors.AddRange(reported);
        }
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
