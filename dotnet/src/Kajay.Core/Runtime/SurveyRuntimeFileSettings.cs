namespace Kajay.Runtime;

internal sealed record SurveyRuntimeFileSettings(
    bool AllowMultiple,
    string AcceptedTypes,
    long MaximumSize,
    int MaximumCount,
    bool StoreContent);
