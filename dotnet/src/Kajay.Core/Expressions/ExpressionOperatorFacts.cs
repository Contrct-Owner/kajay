namespace Kajay.Expressions;

internal static class ExpressionOperatorFacts
{
    public const int LowestParsePrecedence = 1;

    public static bool TryGetBinary(string spelling, out ExpressionOperatorSyntax syntax)
    {
        syntax = spelling.ToLowerInvariant() switch
        {
            "or" or "||" => new(ExpressionOperator.Or, "or", 1, 10),
            "and" or "&&" => new(ExpressionOperator.And, "and", 2, 20),
            "==" or "=" => new(ExpressionOperator.Equal, "==", 3, 30),
            "!=" or "<>" => new(ExpressionOperator.NotEqual, "!=", 3, 30),
            ">" => new(ExpressionOperator.GreaterThan, ">", 3, 30),
            ">=" => new(ExpressionOperator.GreaterThanOrEqual, ">=", 3, 30),
            "<" => new(ExpressionOperator.LessThan, "<", 3, 30),
            "<=" => new(ExpressionOperator.LessThanOrEqual, "<=", 3, 30),
            "contains" => new(ExpressionOperator.Contains, "contains", 3, 30),
            "notcontains" => new(ExpressionOperator.NotContains, "notcontains", 3, 30),
            "anyof" => new(ExpressionOperator.AnyOf, "anyof", 3, 30),
            "allof" => new(ExpressionOperator.AllOf, "allof", 3, 30),
            "+" => new(ExpressionOperator.Add, "+", 4, 40),
            "-" => new(ExpressionOperator.Subtract, "-", 4, 40),
            "*" => new(ExpressionOperator.Multiply, "*", 5, 50),
            "/" => new(ExpressionOperator.Divide, "/", 5, 50),
            "%" => new(ExpressionOperator.Remainder, "%", 5, 50),
            "^" => new(ExpressionOperator.Power, "^", 6, 60, true),
            _ => default,
        };
        return syntax.Canonical is not null;
    }

    public static bool TryGetUnary(string spelling, out ExpressionOperatorSyntax syntax)
    {
        syntax = spelling.ToLowerInvariant() switch
        {
            "not" or "!" => new(ExpressionOperator.Not, "not", 6, 55),
            "-" => new(ExpressionOperator.Negate, "-", 6, 55),
            _ => default,
        };
        return syntax.Canonical is not null;
    }

    public static bool TryGetPostfix(string spelling, out ExpressionOperatorSyntax syntax)
    {
        syntax = spelling.ToLowerInvariant() switch
        {
            "empty" => new(ExpressionOperator.Empty, "empty", 0, 70),
            "notempty" => new(ExpressionOperator.NotEmpty, "notempty", 0, 70),
            _ => default,
        };
        return syntax.Canonical is not null;
    }

    public static ExpressionOperatorSyntax Get(ExpressionOperator expressionOperator)
    {
        return expressionOperator switch
        {
            ExpressionOperator.Or => Binary("or"),
            ExpressionOperator.And => Binary("and"),
            ExpressionOperator.Equal => Binary("=="),
            ExpressionOperator.NotEqual => Binary("!="),
            ExpressionOperator.GreaterThan => Binary(">"),
            ExpressionOperator.GreaterThanOrEqual => Binary(">="),
            ExpressionOperator.LessThan => Binary("<"),
            ExpressionOperator.LessThanOrEqual => Binary("<="),
            ExpressionOperator.Contains => Binary("contains"),
            ExpressionOperator.NotContains => Binary("notcontains"),
            ExpressionOperator.AnyOf => Binary("anyof"),
            ExpressionOperator.AllOf => Binary("allof"),
            ExpressionOperator.Add => Binary("+"),
            ExpressionOperator.Subtract => Binary("-"),
            ExpressionOperator.Multiply => Binary("*"),
            ExpressionOperator.Divide => Binary("/"),
            ExpressionOperator.Remainder => Binary("%"),
            ExpressionOperator.Power => Binary("^"),
            ExpressionOperator.Not => Unary("not"),
            ExpressionOperator.Negate => Unary("-"),
            ExpressionOperator.Empty => Postfix("empty"),
            ExpressionOperator.NotEmpty => Postfix("notempty"),
            _ => throw new ArgumentOutOfRangeException(nameof(expressionOperator)),
        };
    }

    private static ExpressionOperatorSyntax Binary(string spelling)
    {
        _ = TryGetBinary(spelling, out ExpressionOperatorSyntax syntax);
        return syntax;
    }

    private static ExpressionOperatorSyntax Unary(string spelling)
    {
        _ = TryGetUnary(spelling, out ExpressionOperatorSyntax syntax);
        return syntax;
    }

    private static ExpressionOperatorSyntax Postfix(string spelling)
    {
        _ = TryGetPostfix(spelling, out ExpressionOperatorSyntax syntax);
        return syntax;
    }
}
