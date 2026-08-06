namespace Kajay;

/// <summary>Identifies one question rule that rejected the current answer.</summary>
/// <param name="Name">The exact question name.</param>
/// <param name="Kind">The stable validator type.</param>
public sealed record SurveyValidationError(string Name, string Kind);
