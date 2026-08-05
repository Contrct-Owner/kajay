using System.Globalization;
using System.Text.RegularExpressions;

namespace Kajay;

internal static partial class KajayInstant
{
    public static bool TryConvert(KajayValue value, out DateTimeOffset instant)
    {
        if (value.Kind == KajayValueKind.Instant)
        {
            instant = value.GetInstant();
            return true;
        }

        if (value.Kind == KajayValueKind.Text)
        {
            return TryParse(value.GetString(), out instant);
        }

        instant = default;
        return false;
    }

    private static bool TryParse(string value, out DateTimeOffset instant)
    {
        if (DateOnly.TryParseExact(
            value,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out DateOnly day))
        {
            instant = new DateTimeOffset(
                day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            return true;
        }

        if (!DateTimePattern().IsMatch(value))
        {
            instant = default;
            return false;
        }

        string format = value.IndexOf('.', StringComparison.Ordinal) switch
        {
            < 0 => "yyyy-MM-dd'T'HH:mm:ssK",
            int dot => value.AsSpan(dot).IndexOfAny('Z', '+', '-') switch
            {
                2 => "yyyy-MM-dd'T'HH:mm:ss.fK",
                3 => "yyyy-MM-dd'T'HH:mm:ss.ffK",
                _ => "yyyy-MM-dd'T'HH:mm:ss.fffK",
            },
        };

        return DateTimeOffset.TryParseExact(
            value,
            format,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal,
            out instant);
    }

    [GeneratedRegex(
        "\\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,3})?(?:Z|[+-][0-9]{2}:[0-9]{2})\\z",
        RegexOptions.CultureInvariant)]
    private static partial Regex DateTimePattern();
}
