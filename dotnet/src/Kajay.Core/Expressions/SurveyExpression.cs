namespace Kajay.Expressions;

/// <summary>A parsed Kajay expression with canonical source representation.</summary>
public sealed class SurveyExpression
{
    private readonly ExpressionNode _root;

    private SurveyExpression(ExpressionNode root)
    {
        _root = root;
        ReferencePaths = ExpressionReferenceCollector.Collect(root);
        ReferencedValuePaths = Array.AsReadOnly(
            ReferencePaths.Select(path => path.Format()).ToArray());
    }

    /// <summary>Gets referenced value paths in first-appearance order without duplicates.</summary>
    public IReadOnlyList<string> ReferencedValuePaths { get; }

    internal IReadOnlyList<ExpressionPath> ReferencePaths { get; }

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

    /// <summary>Evaluates this expression against explicit immutable inputs.</summary>
    /// <param name="context">Answer values, clock, and future extension inputs.</param>
    /// <returns>The evaluated value and all recoverable evaluation errors.</returns>
    public ExpressionEvaluationResult Evaluate(ExpressionEvaluationContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return ExpressionEvaluator.Evaluate(_root, context);
    }

    /// <inheritdoc />
    public override string ToString()
    {
        return ToCanonicalString();
    }
}
