namespace Kajay.Validation;

/// <summary>The synchronous result of checking a survey scope.</summary>
/// <param name="IsValid">Whether every checked answer passed.</param>
/// <param name="Errors">Failures in definition order.</param>
public sealed record SurveyValidationResult(
    bool IsValid,
    IReadOnlyList<SurveyValidationError> Errors);
