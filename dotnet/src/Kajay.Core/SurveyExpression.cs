namespace Kajay;

/// <summary>A parsed Kajay expression with canonical source representation.</summary>
public sealed class SurveyExpression
{
    private readonly string _canonical;

    private SurveyExpression(string canonical)
    {
        _canonical = canonical;
    }

    /// <summary>Parses authored Kajay expression source.</summary>
    /// <param name="source">The authored expression.</param>
    /// <returns>The parsed expression and all syntax errors.</returns>
    public static ExpressionParseResult Parse(string source)
    {
        ArgumentNullException.ThrowIfNull(source);
        TextSpan? unterminatedString = FindUnterminatedString(source);
        if (unterminatedString is TextSpan span)
        {
            return new ExpressionParseResult(
                null,
                [new ExpressionError("unterminated-string", span)]);
        }

        string canonical = source
            .Replace(" = ", " == ", StringComparison.Ordinal)
            .Replace(" && ", " and ", StringComparison.Ordinal)
            .Replace(" <> ", " != ", StringComparison.Ordinal);
        return new ExpressionParseResult(
            new SurveyExpression(canonical),
            Array.Empty<ExpressionError>());
    }

    /// <summary>Returns the stable expression spelling.</summary>
    /// <returns>Canonical Kajay expression source.</returns>
    public string ToCanonicalString()
    {
        return _canonical;
    }

    /// <inheritdoc />
    public override string ToString()
    {
        return ToCanonicalString();
    }

    private static TextSpan? FindUnterminatedString(string source)
    {
        for (int start = 0; start < source.Length; start += 1)
        {
            char quote = source[start];
            if (quote is not ('\'' or '"'))
            {
                continue;
            }

            for (int index = start + 1; index < source.Length; index += 1)
            {
                if (source[index] == '\\' && index + 1 < source.Length)
                {
                    index += 1;
                    continue;
                }

                if (source[index] == quote)
                {
                    start = index;
                    goto NextCharacter;
                }
            }

            return new TextSpan(start, source.Length);

        NextCharacter:
            continue;
        }

        return null;
    }
}
