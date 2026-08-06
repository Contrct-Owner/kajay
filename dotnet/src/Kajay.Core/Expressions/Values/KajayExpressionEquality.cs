namespace Kajay.Expressions.Values;

internal static class KajayExpressionEquality
{
    public static bool Equals(KajayValue left, KajayValue right)
    {
        if (left.Kind == right.Kind)
        {
            return left == right;
        }

        if (IsAbsentOrNull(left) && IsAbsentOrNull(right))
        {
            return true;
        }

        if (IsNumberAndText(left, right)
            && KajayNumber.TryConvert(left, out double leftNumber)
            && KajayNumber.TryConvert(right, out double rightNumber))
        {
            return leftNumber == rightNumber;
        }

        return false;
    }

    private static bool IsAbsentOrNull(KajayValue value)
    {
        return value.Kind is KajayValueKind.Absent or KajayValueKind.Null;
    }

    private static bool IsNumberAndText(KajayValue left, KajayValue right)
    {
        return left.Kind == KajayValueKind.Number && right.Kind == KajayValueKind.Text
            || left.Kind == KajayValueKind.Text && right.Kind == KajayValueKind.Number;
    }
}
