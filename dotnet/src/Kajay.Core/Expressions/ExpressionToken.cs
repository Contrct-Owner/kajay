namespace Kajay.Expressions;

internal readonly record struct ExpressionToken(
    ExpressionTokenKind Kind,
    string Text,
    TextSpan Span);
