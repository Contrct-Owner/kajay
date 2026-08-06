namespace Kajay.Runtime;

internal sealed record SurveyRuntimeMatrixSettings(
    bool RequireEveryRow,
    bool RequireUniqueColumns,
    IReadOnlyList<SurveyRuntimeQuestion> Fields);
