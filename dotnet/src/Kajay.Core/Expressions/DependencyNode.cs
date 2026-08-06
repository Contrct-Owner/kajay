namespace Kajay.Expressions;

internal sealed record DependencyNode(
    string Key,
    IReadOnlyList<DependencyPattern> Reads,
    ExpressionPath? Writes = null)
{
    internal static DependencyNode FromExpression(
        string key,
        SurveyExpression expression,
        ExpressionPath? writes = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(key);
        ArgumentNullException.ThrowIfNull(expression);
        return new DependencyNode(
            key,
            expression.ReferencePaths.Select(DependencyPattern.Exact).ToArray(),
            writes);
    }
}
