namespace Kajay;

internal sealed record SurveyRuntimeRecordSettings(
    int MinimumCount,
    int MaximumCount,
    bool AllowAdd,
    bool AllowRemove,
    KajayValue DefaultRecord,
    bool CopyPrevious,
    IReadOnlyList<SurveyRuntimeQuestion> Fields);
