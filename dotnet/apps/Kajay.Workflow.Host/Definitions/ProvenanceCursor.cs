using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace Kajay.Workflow.Host.Definitions;

internal static class ProvenanceCursor
{
    internal static string ForRevision(long number) => Encode($"r1|{number}");

    internal static long ReadRevision(string value)
    {
        string[] parts = Decode(value, "r1", 2);
        return long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out long number)
            && number > 0
            ? number
            : throw Invalid();
    }

    internal static string ForRelease(DateTimeOffset installedAt, string digest) =>
        Encode($"l1|{installedAt.UtcTicks}|{digest}");

    internal static ReleasePageCursor ReadRelease(string value)
    {
        string[] parts = Decode(value, "l1", 3);
        return long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out long ticks)
            && ticks >= DateTimeOffset.MinValue.UtcTicks
            && ticks <= DateTimeOffset.MaxValue.UtcTicks
            && parts[2].Length != 0
            ? new ReleasePageCursor(new DateTimeOffset(ticks, TimeSpan.Zero), parts[2])
            : throw Invalid();
    }

    internal static string ForAudit(DateTimeOffset occurredAt, Guid id) =>
        Encode($"a1|{occurredAt.UtcTicks}|{id:N}");

    internal static AuditPageCursor ReadAudit(string value)
    {
        string[] parts = Decode(value, "a1", 3);
        return long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out long ticks)
            && ticks >= DateTimeOffset.MinValue.UtcTicks
            && ticks <= DateTimeOffset.MaxValue.UtcTicks
            && Guid.TryParseExact(parts[2], "N", out Guid id)
            ? new AuditPageCursor(new DateTimeOffset(ticks, TimeSpan.Zero), id)
            : throw Invalid();
    }

    private static string Encode(string value) =>
        WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(value));

    private static string[] Decode(string value, string prefix, int count)
    {
        try
        {
            string decoded = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(value));
            string[] parts = decoded.Split('|');
            return parts.Length == count && parts[0] == prefix ? parts : throw Invalid();
        }
        catch (FormatException)
        {
            throw Invalid();
        }
    }

    private static FormatException Invalid() =>
        new("The pagination cursor is invalid or belongs to another collection.");
}

internal readonly record struct ReleasePageCursor(DateTimeOffset InstalledAt, string Digest);

internal readonly record struct AuditPageCursor(DateTimeOffset OccurredAt, Guid Id);
