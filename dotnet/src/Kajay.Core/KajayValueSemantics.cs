namespace Kajay;

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
}
