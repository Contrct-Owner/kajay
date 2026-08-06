namespace Kajay;

internal sealed record SurveyChoiceCacheKey(
    string Url,
    string Path,
    string ValueName,
    string TitleName);
