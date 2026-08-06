namespace Kajay.Hosting;

internal sealed record SurveyChoiceCacheKey(
    string Url,
    string Path,
    string ValueName,
    string TitleName);
