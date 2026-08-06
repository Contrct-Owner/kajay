using Kajay.Workflow.Host.Authentication;
using Microsoft.Net.Http.Headers;

namespace Kajay.Workflow.Host.Api;

internal static class WorkflowRequestContext
{
    internal static string ReadTenant(HttpContext context)
    {
        return ReadRequiredClaim(
            context,
            WorkOSClaimValues.OrganizationId,
            "organization-identity-required");
    }

    internal static string ReadActor(HttpContext context)
    {
        return ReadRequiredClaim(context, WorkOSClaimValues.Subject, "actor-identity-required");
    }

    internal static string ReadIdempotencyKey(HttpContext context)
    {
        return ReadRequiredHeader(context, "Idempotency-Key", "idempotency-key-required");
    }

    internal static long ReadExpectedVersion(HttpContext context)
    {
        string value = ReadRequiredHeader(context, HeaderNames.IfMatch, "if-match-required");
        string unquoted = value.Trim().Trim('"');
        return long.TryParse(unquoted, out long version) && version >= 0
            ? version
            : throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-if-match",
                "If-Match must contain a non-negative numeric version.");
    }

    private static string ReadRequiredHeader(HttpContext context, string name, string code)
    {
        string value = context.Request.Headers[name].ToString().Trim();
        if (string.IsNullOrEmpty(value) || value.Length > 128)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                code,
                $"Header '{name}' must contain 1 to 128 characters.");
        }
        return value;
    }

    private static string ReadRequiredClaim(HttpContext context, string claimType, string code)
    {
        string value = context.User.FindFirst(claimType)?.Value.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(value) || value.Length > 128)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status401Unauthorized,
                code,
                $"The authenticated principal requires a valid '{claimType}' claim.");
        }
        return value;
    }
}
