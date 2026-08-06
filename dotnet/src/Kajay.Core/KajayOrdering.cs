namespace Kajay;

internal static class KajayOrdering
{
    public static bool TryCompare(KajayValue left, KajayValue right, out int comparison)
    {
        if (TryCompareNumbers(left, right, out comparison))
        {
            return true;
        }

        if (left.Kind == KajayValueKind.Text && right.Kind == KajayValueKind.Text)
        {
            comparison = string.CompareOrdinal(left.GetString(), right.GetString());
            return true;
        }

        if (left.Kind == KajayValueKind.Instant && right.Kind == KajayValueKind.Instant)
        {
            comparison = DateTimeOffset.Compare(left.GetInstant(), right.GetInstant());
            return true;
        }

        comparison = default;
        return false;
    }

    private static bool TryCompareNumbers(
        KajayValue left,
        KajayValue right,
        out int comparison)
    {
        bool includesNumber = left.Kind == KajayValueKind.Number
            || right.Kind == KajayValueKind.Number;
        if (includesNumber
            && KajayNumber.TryConvert(left, out double leftNumber)
            && KajayNumber.TryConvert(right, out double rightNumber))
        {
            comparison = leftNumber.CompareTo(rightNumber);
            return true;
        }

        comparison = default;
        return false;
    }
}
