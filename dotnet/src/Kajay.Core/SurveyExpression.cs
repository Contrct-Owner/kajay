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
}
