namespace Kajay.Expressions.Values;

internal static class KajayValueSemantics
{
    public static bool IsEmpty(KajayValue value)
    {
        return value.Kind switch
        {
            KajayValueKind.Absent or KajayValueKind.Null => true,
            KajayValueKind.Text => value.GetString().Length == 0,
            KajayValueKind.Array => value.GetArray().Count == 0,
            _ => false,
        };
    }

    public static bool IsTruthy(KajayValue value)
    {
        return value.Kind switch
        {
            KajayValueKind.Absent or KajayValueKind.Null => false,
            KajayValueKind.Boolean => value.GetBoolean(),
            KajayValueKind.Number => value.GetNumber() != 0,
            KajayValueKind.Text => value.GetString().Length != 0,
            KajayValueKind.Array => value.GetArray().Count != 0,
            KajayValueKind.Instant or KajayValueKind.Map => true,
            _ => throw new ArgumentOutOfRangeException(nameof(value)),
        };
    }
}
