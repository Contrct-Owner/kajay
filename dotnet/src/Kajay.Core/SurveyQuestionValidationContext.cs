namespace Kajay;

/// <summary>Immutable inputs supplied to a host question validator.</summary>
/// <param name="Name">The exact authored question name.</param>
/// <param name="ValueName">The exact submitted answer key.</param>
/// <param name="Value">The current answer, or absent.</param>
/// <param name="Data">The settled submitted-data snapshot.</param>
public sealed record SurveyQuestionValidationContext(
    string Name,
    string ValueName,
    KajayValue Value,
    IReadOnlyDictionary<string, KajayValue> Data);
