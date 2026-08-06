namespace Kajay.Expressions;

internal sealed record ExpressionTokenizationResult(
    IReadOnlyList<ExpressionToken> Tokens,
    IReadOnlyList<ExpressionError> Errors);
