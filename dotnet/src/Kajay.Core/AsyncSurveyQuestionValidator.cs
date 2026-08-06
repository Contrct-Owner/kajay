namespace Kajay;

/// <summary>Performs an asynchronous cancellation-aware host question check.</summary>
/// <param name="context">The immutable question and survey inputs.</param>
/// <param name="cancellationToken">Cancels the pending check.</param>
/// <returns>Additional errors in host-defined order.</returns>
public delegate ValueTask<IReadOnlyList<SurveyValidationError>> AsyncSurveyQuestionValidator(
    SurveyQuestionValidationContext context,
    CancellationToken cancellationToken);
