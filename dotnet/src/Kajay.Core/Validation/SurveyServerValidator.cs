namespace Kajay.Validation;

/// <summary>Checks a settled validation scope through a host-owned service.</summary>
/// <param name="context">The immutable data and exact question scope.</param>
/// <param name="cancellationToken">Cancels the pending check.</param>
/// <returns>Named errors in server-defined order.</returns>
public delegate ValueTask<IReadOnlyList<SurveyValidationError>> SurveyServerValidator(
    SurveyServerValidationContext context,
    CancellationToken cancellationToken);
