namespace Kajay.Runtime;

internal sealed record SurveyRuntimeChoiceSettings(
    string FromQuestion,
    string FromQuestionMode,
    string Url,
    string Path,
    string ValueName,
    string TitleName,
    bool LazyLoadEnabled,
    int LazyLoadPageSize);
