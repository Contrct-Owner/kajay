namespace Kajay;

internal sealed record ExpressionParseTreeResult(
    ExpressionNode Root,
    IReadOnlyList<ExpressionError> Errors);
