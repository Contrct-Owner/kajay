namespace Kajay.Runtime;

internal sealed record SurveyRuntimeSignatureSettings(
    string PenColor,
    string BackgroundColor,
    SurveySignatureFormat Format,
    int Width,
    int Height);
