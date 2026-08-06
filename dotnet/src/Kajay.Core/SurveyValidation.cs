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
            || _survey.CurrentPageIndex >= _definition.Pages.Count)
        {
            return new SurveyValidationResult(true, []);
        }

        var errors = new List<SurveyValidationError>();
        foreach (SurveyRuntimeQuestion question in
            _definition.Pages[_survey.CurrentPageIndex].Questions)
        {
            ValidateQuestion(question, errors);
        }

        return new SurveyValidationResult(errors.Count == 0, errors.AsReadOnly());
    }

    private void ValidateQuestion(
        SurveyRuntimeQuestion question,
        List<SurveyValidationError> errors)
    {
        KajayValue value = _survey.GetValue(question.Name);
        if (KajayValueSemantics.IsEmpty(value)
            || !KajayText.TryConvert(value, out string text))
        {
            return;
        }

        foreach (SurveyRuntimeValidator validator in question.Validators)
        {
            if (!string.Equals(
                    validator.Type,
                    "regexvalidator",
                    StringComparison.Ordinal))
            {
                continue;
            }

            if (validator.CompiledPattern is not null
                && !validator.CompiledPattern.IsMatch(text))
            {
                errors.Add(new SurveyValidationError(question.Name, validator.Type));
            }
        }
    }
}
