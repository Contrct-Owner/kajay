using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace Kajay.Workflow.Host.Workflows;

internal static class ReviewTaskCursor
{
    internal static string Encode(DateTimeOffset createdAt, Guid id) =>
        WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(
            $"q1|{createdAt.UtcTicks}|{id:N}"));

    internal static ReviewTaskPageCursor Decode(string value)
    {
        try
        {
            string decoded = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(value));
            string[] parts = decoded.Split('|');
            return parts.Length == 3
                && parts[0] == "q1"
                && long.TryParse(
                    parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out long ticks)
                && ticks >= DateTimeOffset.MinValue.UtcTicks
                && ticks <= DateTimeOffset.MaxValue.UtcTicks
                && Guid.TryParseExact(parts[2], "N", out Guid id)
                ? new ReviewTaskPageCursor(new DateTimeOffset(ticks, TimeSpan.Zero), id)
                : throw Invalid();
        }
        catch (FormatException)
        {
            throw Invalid();
        }
    }

    private static FormatException Invalid() =>
        new("The pagination cursor is invalid or belongs to another collection.");
}

internal readonly record struct ReviewTaskPageCursor(DateTimeOffset CreatedAt, Guid Id);
