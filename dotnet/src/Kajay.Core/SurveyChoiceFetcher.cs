namespace Kajay;

/// <summary>Loads a closed Kajay payload for a definition-authored choice resource.</summary>
/// <param name="request">The resolved request.</param>
/// <param name="cancellationToken">Cancels the host operation.</param>
/// <returns>An array payload, or an object containing the configured array path.</returns>
public delegate ValueTask<KajayValue> SurveyChoiceFetcher(
    SurveyChoiceFetchRequest request,
    CancellationToken cancellationToken);
