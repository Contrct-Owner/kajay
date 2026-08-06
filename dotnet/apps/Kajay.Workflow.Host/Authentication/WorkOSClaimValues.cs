using System.Security.Claims;
using System.Text.Json;

namespace Kajay.Workflow.Host.Authentication;

internal static class WorkOSClaimValues
{
    internal const string OrganizationId = "org_id";
    internal const string Permissions = "permissions";
    internal const string Subject = "sub";

    internal static bool Contains(ClaimsPrincipal principal, string claimType, string value)
    {
        return principal.FindAll(claimType).Any(claim => Contains(claim.Value, value));
    }

    internal static IEnumerable<string> Read(ClaimsPrincipal principal, string claimType)
    {
        return principal.FindAll(claimType).SelectMany(claim => Read(claim.Value)).Distinct();
    }

    private static bool Contains(string claimValue, string expected)
    {
        if (string.Equals(claimValue, expected, StringComparison.Ordinal))
        {
            return true;
        }
        if (claimValue.Length == 0 || claimValue[0] != '[')
        {
            return false;
        }
        try
        {
            string[]? values = JsonSerializer.Deserialize<string[]>(claimValue);
            return values?.Contains(expected, StringComparer.Ordinal) is true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string[] Read(string claimValue)
    {
        if (claimValue.Length == 0)
        {
            return [];
        }
        if (claimValue[0] != '[')
        {
            return [claimValue];
        }
        try
        {
            return JsonSerializer.Deserialize<string[]>(claimValue) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
