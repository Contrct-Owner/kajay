using System.Security.Claims;

namespace Kajay.Workflow.Host.Authentication;

internal static class WorkOSSessionEndpoints
{
    internal static WebApplication MapWorkOSSessionEndpoints(this WebApplication app)
    {
        WorkOSAuthenticationOptions options = app.Services
            .GetRequiredService<WorkOSAuthenticationOptions>();
        if (!options.Session.Enabled)
        {
            return app;
        }
        _ = app.MapGet(
            "/auth/login",
            (HttpContext context, WorkOSLoginApplication login, string? loginHint) =>
                login.Start(context, loginHint));
        _ = app.MapGet(
            "/auth/callback",
            (HttpContext context, WorkOSLoginApplication login, string? code, string? state,
                string? error, CancellationToken cancellationToken) =>
                    login.CompleteAsync(context, code, state, error, cancellationToken));
        _ = app.MapPost(
            "/auth/logout",
            (HttpContext context, WorkOSLoginApplication login) => login.Logout(context));
        _ = app.MapGet("/auth/session", CreateSessionResult).RequireAuthorization();
        return app;
    }

    private static IResult CreateSessionResult(ClaimsPrincipal user)
    {
        string subject = user.FindFirstValue(WorkOSClaimValues.Subject)!;
        string organizationId = user.FindFirstValue(WorkOSClaimValues.OrganizationId)!;
        string[] permissions = WorkOSClaimValues.Read(
                user,
                WorkOSClaimValues.Permissions)
            .Order(StringComparer.Ordinal)
            .ToArray();
        return Results.Ok(new WorkOSSessionResult(subject, organizationId, permissions));
    }
}
