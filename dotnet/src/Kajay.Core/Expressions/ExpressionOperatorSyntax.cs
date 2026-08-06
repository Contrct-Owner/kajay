namespace Kajay.Expressions;

internal readonly record struct ExpressionOperatorSyntax(
    ExpressionOperator Operator,
    string Canonical,
    int ParsePrecedence,
    int PrintPrecedence,
    bool IsRightAssociative = false);
