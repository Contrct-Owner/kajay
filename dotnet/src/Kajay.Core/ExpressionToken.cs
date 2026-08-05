namespace Kajay;

internal readonly record struct ExpressionToken(
    ExpressionTokenKind Kind,
    string Text,
    TextSpan Span);
