namespace Kajay;

/// <summary>Identifies one question rule that rejected the current answer.</summary>
/// <param name="Name">The exact question name.</param>
/// <param name="Kind">The stable validator type.</param>
/// <param name="Message">The authored message, or an empty string for the SDK default.</param>
public sealed record SurveyValidationError(string Name, string Kind, string Message = "");
