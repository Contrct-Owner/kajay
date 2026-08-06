namespace Kajay.Validation;

/// <summary>The immutable survey scope supplied to a host/server validator.</summary>
/// <param name="Data">The settled submitted-data snapshot.</param>
/// <param name="QuestionNames">The exact question names covered by this validation gate.</param>
public sealed record SurveyServerValidationContext(
    IReadOnlyDictionary<string, KajayValue> Data,
    IReadOnlyList<string> QuestionNames);
