namespace Kajay.Expressions.Values;

internal static class KajayMembership
{
    public static bool Evaluate(
        ExpressionOperator expressionOperator,
        KajayValue left,
        KajayValue right)
    {
        IReadOnlyList<KajayValue> haystack = ToSequence(left);
        if (expressionOperator is ExpressionOperator.Contains or ExpressionOperator.NotContains)
        {
            bool found = left.Kind == KajayValueKind.Text && right.Kind == KajayValueKind.Text
                ? left.GetString().Contains(right.GetString(), StringComparison.Ordinal)
                : haystack.Any(item => KajayExpressionEquality.Equals(item, right));
            return expressionOperator == ExpressionOperator.Contains ? found : !found;
        }

        IReadOnlyList<KajayValue> needles = ToSequence(right);
        if (expressionOperator == ExpressionOperator.AnyOf)
        {
            return needles.Any(needle =>
                haystack.Any(item => KajayExpressionEquality.Equals(item, needle)));
        }

        return needles.All(needle =>
            haystack.Any(item => KajayExpressionEquality.Equals(item, needle)));
    }

    private static IReadOnlyList<KajayValue> ToSequence(KajayValue value)
    {
        if (value.Kind == KajayValueKind.Array)
        {
            return value.GetArray();
        }

        return value.Kind is KajayValueKind.Absent or KajayValueKind.Null
            ? Array.Empty<KajayValue>()
            : [value];
    }
}
