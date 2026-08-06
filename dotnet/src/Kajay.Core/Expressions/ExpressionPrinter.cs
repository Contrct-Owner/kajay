using System.Globalization;

namespace Kajay.Expressions;

internal static class ExpressionPrinter
{
    private const int PrimaryPrecedence = 100;

    public static string Print(ExpressionNode node)
    {
        return node switch
        {
            ExpressionNode.Literal literal => PrintLiteral(literal.Value),
            ExpressionNode.Reference reference => $"{{{reference.Path.Format()}}}",
            ExpressionNode.Array array => $"[{string.Join(", ", array.Items.Select(Print))}]",
            ExpressionNode.Call call => $"{call.Name}({string.Join(", ", call.Arguments.Select(Print))})",
            ExpressionNode.Unary unary => PrintUnary(unary),
            ExpressionNode.Postfix postfix => PrintPostfix(postfix),
            ExpressionNode.Binary binary => PrintBinary(binary),
            _ => "«error»",
        };
    }

    private static string PrintLiteral(object? value)
    {
        return value switch
        {
            null => "null",
            string text => $"'{text.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("'", "\\'", StringComparison.Ordinal)}'",
            bool boolean => boolean ? "true" : "false",
            double number => number.ToString("R", CultureInfo.InvariantCulture),
            _ => throw new InvalidOperationException("Unknown expression literal kind."),
        };
    }

    private static string PrintUnary(ExpressionNode.Unary unary)
    {
        ExpressionOperatorSyntax syntax = ExpressionOperatorFacts.Get(unary.Operator);
        string separator = unary.Operator == ExpressionOperator.Not ? " " : string.Empty;
        return $"{syntax.Canonical}{separator}{Wrap(unary.Operand, 60)}";
    }

    private static string PrintPostfix(ExpressionNode.Postfix postfix)
    {
        ExpressionOperatorSyntax syntax = ExpressionOperatorFacts.Get(postfix.Operator);
        return $"{Wrap(postfix.Operand, syntax.PrintPrecedence)} {syntax.Canonical}";
    }

    private static string PrintBinary(ExpressionNode.Binary binary)
    {
        ExpressionOperatorSyntax syntax = ExpressionOperatorFacts.Get(binary.Operator);
        int precedence = syntax.PrintPrecedence;
        int leftMinimum = syntax.IsRightAssociative ? precedence + 1 : precedence;
        int rightMinimum = syntax.IsRightAssociative ? precedence : precedence + 1;
        return $"{Wrap(binary.Left, leftMinimum)} {syntax.Canonical} {Wrap(binary.Right, rightMinimum)}";
    }

    private static string Wrap(ExpressionNode node, int minimumPrecedence)
    {
        string printed = Print(node);
        return GetPrecedence(node) < minimumPrecedence ? $"({printed})" : printed;
    }

    private static int GetPrecedence(ExpressionNode node)
    {
        return node switch
        {
            ExpressionNode.Binary binary => ExpressionOperatorFacts.Get(binary.Operator).PrintPrecedence,
            ExpressionNode.Unary unary => ExpressionOperatorFacts.Get(unary.Operator).PrintPrecedence,
            ExpressionNode.Postfix postfix => ExpressionOperatorFacts.Get(postfix.Operator).PrintPrecedence,
            _ => PrimaryPrecedence,
        };
    }
}
