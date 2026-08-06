namespace Kajay;

/// <summary>Checks authored answer rules against a survey's current data.</summary>
public sealed class SurveyValidation
{
    private readonly Survey _survey;
    private readonly SurveyRuntimeDefinition _definition;

    internal SurveyValidation(Survey survey, SurveyRuntimeDefinition definition)
    {
        _survey = survey;
        _definition = definition;
    }

    /// <summary>Checks the questions on the current page.</summary>
    /// <returns>Whether the page passed and each failed rule in definition order.</returns>
    public SurveyValidationResult ValidateCurrentPage()
    {
        if (_survey.State != SurveyState.Running
            || _survey.CurrentAuthoredPageIndex < 0)
        {
            return new SurveyValidationResult(true, []);
        }

        var errors = new List<SurveyValidationError>();
        foreach (SurveyRuntimeQuestion question in
            _definition.Pages[_survey.CurrentAuthoredPageIndex].Questions)
        {
            if (_survey.TryGetQuestionState(question.Name, out SurveyQuestionState state)
                && state.IsReachable)
            {
                ValidateQuestion(question, errors);
            }
        }

        return new SurveyValidationResult(errors.Count == 0, errors.AsReadOnly());
    }

    private void ValidateQuestion(
        SurveyRuntimeQuestion question,
        List<SurveyValidationError> errors)
    {
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
            }
            return;
        }

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
