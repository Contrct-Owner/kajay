namespace Kajay;

/// <summary>Checks the settled submitted-data snapshot through a host-owned service.</summary>
/// <param name="data">The immutable submitted-data snapshot.</param>
/// <param name="cancellationToken">Cancels the pending check.</param>
/// <returns>Named errors in server-defined order.</returns>
public delegate ValueTask<IReadOnlyList<SurveyValidationError>> SurveyServerValidator(
    IReadOnlyDictionary<string, KajayValue> data,
    CancellationToken cancellationToken);
