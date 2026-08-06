namespace Kajay.Hosting;

/// <summary>Loads one server-filtered page of choices.</summary>
/// <param name="request">The immutable page request.</param>
/// <param name="cancellationToken">Cancels the host operation.</param>
/// <returns>The requested page.</returns>
public delegate ValueTask<SurveyChoicePage> SurveyChoicePageLoader(
    SurveyChoicePageRequest request,
    CancellationToken cancellationToken);
