namespace Kajay.Validation;

/// <summary>Performs a synchronous host-defined question check.</summary>
/// <param name="context">The immutable question and survey inputs.</param>
/// <returns>Additional errors in host-defined order.</returns>
public delegate IReadOnlyList<SurveyValidationError> SurveyQuestionValidator(
    SurveyQuestionValidationContext context);
