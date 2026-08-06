using System.Globalization;

namespace Kajay;

internal static class KajayText
{
    public static bool TryConvert(KajayValue value, out string text)
    {
        switch (value.Kind)
        {
            case KajayValueKind.Absent:
            case KajayValueKind.Null:
                text = string.Empty;
                return true;
            case KajayValueKind.Boolean:
                text = value.GetBoolean() ? "true" : "false";
                return true;
            case KajayValueKind.Number:
                text = value.GetNumber().ToString("R", CultureInfo.InvariantCulture);
                return true;
            case KajayValueKind.Text:
                text = value.GetString();
                return true;
            case KajayValueKind.Instant:
                text = value.GetInstant().UtcDateTime.ToString(
                    "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                    CultureInfo.InvariantCulture);
                return true;
            default:
                text = string.Empty;
                return false;
        }
    }
}
