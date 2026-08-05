using System.Globalization;

namespace Kajay;

internal sealed class ExpressionParser
{
    private readonly IReadOnlyList<ExpressionToken> _tokens;
    private readonly List<ExpressionError> _errors;
    private int _position;

    private ExpressionParser(ExpressionTokenizationResult tokenization)
    {
        _tokens = tokenization.Tokens;
        _errors = [.. tokenization.Errors];
    }

    public static ExpressionParseTreeResult Parse(string source)
    {
        ExpressionParser parser = new(ExpressionTokenizer.Tokenize(source));
        ExpressionNode root = parser.ParseRoot();
        return new ExpressionParseTreeResult(root, parser._errors);
    }

    private ExpressionNode ParseRoot()
    {
        if (Peek().Kind == ExpressionTokenKind.End)
        {
            return Fail("empty-expression", Peek().Span);
        }

        ExpressionNode root = ParseBinary(ExpressionOperatorFacts.LowestParsePrecedence);
        if (Peek().Kind != ExpressionTokenKind.End)
        {
            _errors.Add(new ExpressionError("unexpected-trailing-input", Peek().Span));
        }

        return root;
    }

    private ExpressionNode ParseBinary(int minimumPrecedence)
    {
        ExpressionNode left = ParseUnary();
        while (TryReadBinary(out ExpressionOperatorSyntax syntax)
            && syntax.ParsePrecedence >= minimumPrecedence)
        {
            _ = Advance();
            int nextMinimum = syntax.IsRightAssociative
                ? syntax.ParsePrecedence
                : syntax.ParsePrecedence + 1;
            ExpressionNode right = ParseBinary(nextMinimum);
            left = new ExpressionNode.Binary(
                Span(left.Span, right.Span),
                syntax.Operator,
                left,
                right);
        }

        return left;
    }

    private ExpressionNode ParseUnary()
    {
        ExpressionToken token = Peek();
        if (CanBeOperator(token)
            && ExpressionOperatorFacts.TryGetUnary(token.Text, out ExpressionOperatorSyntax syntax))
        {
            _ = Advance();
            ExpressionNode operand = ParseBinary(syntax.ParsePrecedence);
            return new ExpressionNode.Unary(
                Span(token.Span, operand.Span),
                syntax.Operator,
                operand);
        }

        return ParsePostfix();
    }

    private ExpressionNode ParsePostfix()
    {
        ExpressionNode operand = ParsePrimary();
        while (CanBeOperator(Peek())
            && ExpressionOperatorFacts.TryGetPostfix(
                Peek().Text,
                out ExpressionOperatorSyntax syntax))
        {
            ExpressionToken token = Advance();
            operand = new ExpressionNode.Postfix(
                Span(operand.Span, token.Span),
                syntax.Operator,
                operand);
        }

        return operand;
    }

    private ExpressionNode ParsePrimary()
    {
        ExpressionToken token = Advance();
        return token.Kind switch
        {
            ExpressionTokenKind.Number => ParseNumber(token),
            ExpressionTokenKind.String => new ExpressionNode.Literal(token.Span, token.Text),
            ExpressionTokenKind.Reference => new ExpressionNode.Reference(token.Span, token.Text),
            ExpressionTokenKind.Identifier => ParseIdentifier(token),
            ExpressionTokenKind.Punctuation => ParsePunctuation(token),
            _ => Fail("unexpected-end", token.Span),
        };
    }

    private ExpressionNode ParseNumber(ExpressionToken token)
    {
        if (double.TryParse(
            token.Text,
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out double value)
            && double.IsFinite(value))
        {
            return new ExpressionNode.Literal(token.Span, value);
        }

        return Fail("invalid-number", token.Span);
    }

    private ExpressionNode ParseIdentifier(ExpressionToken token)
    {
        string lowered = token.Text.ToLowerInvariant();
        if (lowered is "true" or "false")
        {
            return new ExpressionNode.Literal(token.Span, lowered == "true");
        }

        if (lowered is "null" or "undefined")
        {
            return new ExpressionNode.Literal(token.Span, null);
        }

        if (Peek().Kind == ExpressionTokenKind.Punctuation && Peek().Text == "(")
        {
            _ = Advance();
            List<ExpressionNode> arguments = ParseArguments(")");
            TextSpan closing = Expect(")", token.Span);
            return new ExpressionNode.Call(
                Span(token.Span, closing),
                token.Text,
                arguments);
        }

        return Fail("unknown-identifier", token.Span);
    }

    private ExpressionNode ParsePunctuation(ExpressionToken token)
    {
        if (token.Text == "(")
        {
            ExpressionNode inner = ParseBinary(ExpressionOperatorFacts.LowestParsePrecedence);
            _ = Expect(")", token.Span);
            return inner;
        }

        if (token.Text == "[")
        {
            List<ExpressionNode> items = ParseArguments("]");
            TextSpan closing = Expect("]", token.Span);
            return new ExpressionNode.Array(Span(token.Span, closing), items);
        }

        return Fail("unexpected-token", token.Span);
    }

    private List<ExpressionNode> ParseArguments(string closing)
    {
        List<ExpressionNode> arguments = [];
        if (Peek().Kind == ExpressionTokenKind.Punctuation && Peek().Text == closing)
        {
            return arguments;
        }

        while (true)
        {
            arguments.Add(ParseBinary(ExpressionOperatorFacts.LowestParsePrecedence));
            if (Peek().Kind != ExpressionTokenKind.Punctuation || Peek().Text != ",")
            {
                return arguments;
            }

            _ = Advance();
        }
    }

    private TextSpan Expect(string punctuation, TextSpan opened)
    {
        ExpressionToken token = Peek();
        if (token.Kind == ExpressionTokenKind.Punctuation && token.Text == punctuation)
        {
            return Advance().Span;
        }

        _errors.Add(new ExpressionError("unclosed-group", token.Span));
        return opened;
    }

    private bool TryReadBinary(out ExpressionOperatorSyntax syntax)
    {
        ExpressionToken token = Peek();
        if (CanBeOperator(token))
        {
            return ExpressionOperatorFacts.TryGetBinary(token.Text, out syntax);
        }

        syntax = default;
        return false;
    }

    private ExpressionNode.Error Fail(string code, TextSpan span)
    {
        _errors.Add(new ExpressionError(code, span));
        return new ExpressionNode.Error(span);
    }

    private ExpressionToken Peek()
    {
        return _tokens[_position];
    }

    private ExpressionToken Advance()
    {
        ExpressionToken token = Peek();
        if (token.Kind != ExpressionTokenKind.End)
        {
            _position += 1;
        }

        return token;
    }

    private static bool CanBeOperator(ExpressionToken token)
    {
        return token.Kind is ExpressionTokenKind.Identifier or ExpressionTokenKind.Punctuation;
    }

    private static TextSpan Span(TextSpan from, TextSpan to)
    {
        return new TextSpan(from.Start, to.End);
    }
}
