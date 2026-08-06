namespace Kajay.Expressions;

internal sealed record ExpressionParseTreeResult(
    ExpressionNode Root,
    IReadOnlyList<ExpressionError> Errors);
