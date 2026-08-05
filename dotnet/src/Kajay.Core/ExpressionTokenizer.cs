namespace Kajay;

internal static class ExpressionTokenizer
{
    public static ExpressionTokenizationResult Tokenize(string source)
    {
        List<ExpressionToken> tokens = [];
        List<ExpressionError> errors = [];
        int index = 0;

        while (index < source.Length)
        {
            if (char.IsWhiteSpace(source[index]))
            {
                index += 1;
                continue;
            }

            ExpressionToken? token = ReadToken(source, index, errors);
            if (token is null)
            {
                index += 1;
                continue;
            }

            tokens.Add(token.Value);
            index = token.Value.Span.End;
        }

        tokens.Add(new ExpressionToken(
            ExpressionTokenKind.End,
            string.Empty,
            new TextSpan(source.Length, source.Length)));
        return new ExpressionTokenizationResult(tokens, errors);
    }

    private static ExpressionToken? ReadToken(
        string source,
        int index,
        List<ExpressionError> errors)
    {
        char value = source[index];
        if (value is '\'' or '"')
        {
            return ReadString(source, index, errors);
        }

        if (value == '{')
        {
            return ReadReference(source, index, errors);
        }

        if (IsDigit(value))
        {
            return ReadNumber(source, index);
        }

        if (IsIdentifierStart(value))
        {
            return ReadIdentifier(source, index);
        }

        string? punctuation = ReadPunctuation(source, index);
        if (punctuation is not null)
        {
            return new ExpressionToken(
                ExpressionTokenKind.Punctuation,
                punctuation,
                new TextSpan(index, index + punctuation.Length));
        }

        errors.Add(new ExpressionError(
            "unexpected-character",
            new TextSpan(index, index + 1)));
        return null;
    }

    private static ExpressionToken ReadString(
        string source,
        int start,
        List<ExpressionError> errors)
    {
        char quote = source[start];
        int index = start + 1;
        System.Text.StringBuilder value = new();

        while (index < source.Length && source[index] != quote)
        {
            if (source[index] == '\\' && index + 1 < source.Length)
            {
                value.Append(source[index + 1]);
                index += 2;
                continue;
            }

            value.Append(source[index]);
            index += 1;
        }

        if (index == source.Length)
        {
            errors.Add(new ExpressionError(
                "unterminated-string",
                new TextSpan(start, source.Length)));
            return new ExpressionToken(
                ExpressionTokenKind.String,
                value.ToString(),
                new TextSpan(start, source.Length));
        }

        return new ExpressionToken(
            ExpressionTokenKind.String,
            value.ToString(),
            new TextSpan(start, index + 1));
    }

    private static ExpressionToken ReadReference(
        string source,
        int start,
        List<ExpressionError> errors)
    {
        int closing = source.IndexOf('}', start + 1);
        if (closing < 0)
        {
            errors.Add(new ExpressionError(
                "unterminated-reference",
                new TextSpan(start, source.Length)));
            return new ExpressionToken(
                ExpressionTokenKind.Reference,
                source[(start + 1)..],
                new TextSpan(start, source.Length));
        }

        return new ExpressionToken(
            ExpressionTokenKind.Reference,
            source[(start + 1)..closing],
            new TextSpan(start, closing + 1));
    }

    private static ExpressionToken ReadNumber(string source, int start)
    {
        int index = start;
        while (index < source.Length && IsDigit(source[index]))
        {
            index += 1;
        }

        if (index + 1 < source.Length && source[index] == '.' && IsDigit(source[index + 1]))
        {
            index += 1;
            while (index < source.Length && IsDigit(source[index]))
            {
                index += 1;
            }
        }

        index = ReadExponent(source, index);
        return new ExpressionToken(
            ExpressionTokenKind.Number,
            source[start..index],
            new TextSpan(start, index));
    }

    private static int ReadExponent(string source, int index)
    {
        if (index >= source.Length || source[index] is not ('e' or 'E'))
        {
            return index;
        }

        int lookahead = index + 1;
        if (lookahead < source.Length && source[lookahead] is '+' or '-')
        {
            lookahead += 1;
        }

        if (lookahead >= source.Length || !IsDigit(source[lookahead]))
        {
            return index;
        }

        lookahead += 1;
        while (lookahead < source.Length && IsDigit(source[lookahead]))
        {
            lookahead += 1;
        }

        return lookahead;
    }

    private static ExpressionToken ReadIdentifier(string source, int start)
    {
        int end = start + 1;
        while (end < source.Length && IsIdentifierPart(source[end]))
        {
            end += 1;
        }

        return new ExpressionToken(
            ExpressionTokenKind.Identifier,
            source[start..end],
            new TextSpan(start, end));
    }

    private static string? ReadPunctuation(string source, int index)
    {
        if (index + 1 < source.Length)
        {
            string pair = source.Substring(index, 2);
            if (pair is ">=" or "<=" or "==" or "!=" or "<>" or "&&" or "||")
            {
                return pair;
            }
        }

        return source[index] is '+' or '-' or '*' or '/' or '%' or '^'
            or '>' or '<' or '=' or '!' or '(' or ')' or '[' or ']' or ','
            ? source[index].ToString()
            : null;
    }

    private static bool IsDigit(char value)
    {
        return value is >= '0' and <= '9';
    }

    private static bool IsIdentifierStart(char value)
    {
        return value is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or '_';
    }

    private static bool IsIdentifierPart(char value)
    {
        return IsIdentifierStart(value) || IsDigit(value);
    }
}
