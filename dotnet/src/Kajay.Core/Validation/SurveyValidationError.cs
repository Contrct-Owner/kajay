namespace Kajay.Validation;

/// <summary>Identifies one question rule that rejected the current answer.</summary>
/// <param name="Name">The exact question name.</param>
/// <param name="Kind">The stable validator type.</param>
/// <param name="Message">The authored message, or an empty string for the SDK default.</param>
/// <param name="Path">The optional path within a composite answer.</param>
public sealed record SurveyValidationError(
    string Name,
    string Kind,
    string Message = "",
    string Path = "");
