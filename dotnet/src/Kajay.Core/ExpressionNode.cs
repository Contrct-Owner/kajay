namespace Kajay;

internal abstract record ExpressionNode(TextSpan Span)
{
    internal sealed record Literal(TextSpan Span, object? Value) : ExpressionNode(Span);

    internal sealed record Reference(TextSpan Span, string Path) : ExpressionNode(Span);

    internal sealed record Array(TextSpan Span, IReadOnlyList<ExpressionNode> Items)
        : ExpressionNode(Span);

    internal sealed record Unary(
        TextSpan Span,
        ExpressionOperator Operator,
        ExpressionNode Operand)
        : ExpressionNode(Span);

    internal sealed record Postfix(
        TextSpan Span,
        ExpressionOperator Operator,
        ExpressionNode Operand)
        : ExpressionNode(Span);

    internal sealed record Binary(
        TextSpan Span,
        ExpressionOperator Operator,
        ExpressionNode Left,
        ExpressionNode Right)
        : ExpressionNode(Span);

    internal sealed record Call(
        TextSpan Span,
        string Name,
        IReadOnlyList<ExpressionNode> Arguments)
        : ExpressionNode(Span);

    internal sealed record Error(TextSpan Span) : ExpressionNode(Span);
}
