namespace Kajay.Expressions;

/// <summary>Describes one stable expression-language error.</summary>
/// <param name="Code">The language-neutral error code.</param>
/// <param name="Span">The source range responsible for the error.</param>
/// <param name="Message">Optional detail safe to show to a survey author.</param>
public sealed record ExpressionError(
    string Code,
    TextSpan Span,
    string? Message = null);
