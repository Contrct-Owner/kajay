namespace Kajay;

/// <summary>Describes one stable expression-language error.</summary>
/// <param name="Code">The language-neutral error code.</param>
/// <param name="Span">The source range responsible for the error.</param>
public sealed record ExpressionError(string Code, TextSpan Span);
