namespace Kajay;

/// <summary>A parsed Kajay expression with canonical source representation.</summary>
public sealed class SurveyExpression
{
    private readonly ExpressionNode _root;

    private SurveyExpression(ExpressionNode root)
    {
        _root = root;
    }

    /// <summary>Parses authored Kajay expression source.</summary>
    /// <param name="source">The authored expression.</param>
    /// <returns>The parsed expression and all syntax errors.</returns>
    public static ExpressionParseResult Parse(string source)
    {
        ArgumentNullException.ThrowIfNull(source);
        ExpressionParseTreeResult parsed = ExpressionParser.Parse(source);
        return new ExpressionParseResult(
            parsed.Errors.Count == 0 ? new SurveyExpression(parsed.Root) : null,
            parsed.Errors);
    }

    /// <summary>Returns the stable expression spelling.</summary>
    /// <returns>Canonical Kajay expression source.</returns>
    public string ToCanonicalString()
    {
        return ExpressionPrinter.Print(_root);
    }

    /// <inheritdoc />
    public override string ToString()
    {
        return ToCanonicalString();
    }
}
