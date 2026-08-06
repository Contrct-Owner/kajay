namespace Kajay.Hosting;

/// <summary>Describes one definition-authored choice resource request.</summary>
/// <param name="QuestionName">The exact authored question name.</param>
/// <param name="Url">The resolved URL-like resource identifier.</param>
/// <param name="Clock">The explicit UTC clock captured for this request.</param>
public sealed record SurveyChoiceFetchRequest(
    string QuestionName,
    string Url,
    DateTimeOffset Clock);
