namespace Kajay.Validation;

internal sealed class SurveyQuestionValidationPipeline
{
    private readonly Survey _survey;
    private readonly SurveyQuestionValidator? _questionValidator;
    private readonly SurveyCompositeValidation _compositeValidation;

    internal SurveyQuestionValidationPipeline(
        Survey survey,
        SurveyQuestionValidator? questionValidator)
    {
        _survey = survey;
        _questionValidator = questionValidator;
        _compositeValidation = new SurveyCompositeValidation(survey);
    }

    internal void Validate(
        SurveyRuntimeQuestion question,
        List<SurveyValidationError> errors)
    {
        int previousErrorCount = errors.Count;
        KajayValue value = _survey.GetValue(question.ValueKey);
        if (KajayValueSemantics.IsEmpty(value))
        {
            ValidateRequired(question, errors);
        }
        else
        {
            ValidateRules(question, value, errors);
            ValidateFile(question, value, errors);
        }

        _compositeValidation.Validate(question, value, errors);
        if (errors.Count == previousErrorCount && _questionValidator is not null)
        {
            IReadOnlyList<SurveyValidationError> reported =
                _questionValidator(CreateContext(question));
            ArgumentNullException.ThrowIfNull(reported);
            errors.AddRange(reported);
        }
    }

    private void ValidateRequired(
        SurveyRuntimeQuestion question,
        List<SurveyValidationError> errors)
    {
        if (question.MatrixSettings?.RequireEveryRow != true
            && _survey.TryGetQuestionState(question.Name, out SurveyQuestionState state)
            && state.IsRequired)
        {
            errors.Add(new SurveyValidationError(
                question.Name,
                "required",
                _survey.ResolveText(question.RequiredMessage)));
        }
    }

    private void ValidateRules(
        SurveyRuntimeQuestion question,
        KajayValue value,
        List<SurveyValidationError> errors)
    {
        foreach (SurveyRuntimeValidator validator in question.Validators)
        {
            if (Fails(validator, value))
            {
                errors.Add(new SurveyValidationError(
                    question.Name,
                    validator.Type,
                    _survey.ResolveText(validator.Message)));
            }
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
