using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Definitions;
using Microsoft.AspNetCore.Authorization;

namespace Kajay.Workflow.Host.Api;

internal static class PromotionEndpoints
{
    internal static IEndpointRouteBuilder MapPromotionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder management = endpoints.MapGroup("/api/management");
        management.MapPost("/releases/preflight", PreflightAsync)
            .RequireAuthorization(KajayPolicies.DefinitionManage);
        management.MapPost("/releases/install", InstallAsync)
            .RequireAuthorization(KajayPolicies.DefinitionPromote);
        management.MapGet("/releases/{releaseDigest}/bundle", ExportAsync)
            .RequireAuthorization(KajayPolicies.DefinitionManage);
        management.MapPut("/environments/{environmentName}/bindings/{name}", SetBindingAsync)
            .RequireAuthorization(KajayPolicies.DefinitionManage);
        management.MapPut(
            "/environments/{environmentName}/activations/{managedDefinitionName}",
            ActivateAsync).RequireAuthorization(KajayPolicies.DefinitionPromote);
        return endpoints;
    }

    private static async Task<IResult> PreflightAsync(
        HttpContext context,
        string environmentName,
        PromotionApplication application,
        CancellationToken cancellationToken)
    {
        byte[] bundle = await BundleRequestReader.ReadAsync(context.Request, cancellationToken)
            .ConfigureAwait(false);
        ReleasePreflightResult result = await application.PreflightAsync(
            WorkflowRequestContext.ReadTenant(context),
            environmentName,
            bundle,
            cancellationToken).ConfigureAwait(false);
        return Results.Ok(result);
    }

    private static async Task<IResult> InstallAsync(
        HttpContext context,
        PromotionApplication application,
        CancellationToken cancellationToken)
    {
        byte[] bundle = await BundleRequestReader.ReadAsync(context.Request, cancellationToken)
            .ConfigureAwait(false);
        ReleaseInstallResult result = await application.InstallAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadActor(context),
            bundle,
            cancellationToken).ConfigureAwait(false);
        return result.Installed
            ? Results.Created($"/api/management/releases/{result.Digest}", result)
            : Results.Ok(result);
    }

    private static async Task<IResult> ExportAsync(
        HttpContext context,
        string releaseDigest,
        PromotionApplication application,
        CancellationToken cancellationToken)
    {
        byte[] bundle = await application.ExportAsync(
            WorkflowRequestContext.ReadTenant(context),
            releaseDigest,
            cancellationToken).ConfigureAwait(false);
        return Results.File(bundle, "application/vnd.kajay.bundle+zip", "definition.kajay");
    }

    private static async Task<IResult> SetBindingAsync(
        HttpContext context,
        string environmentName,
        string name,
        EnvironmentBindingRequest request,
        PromotionApplication application,
        CancellationToken cancellationToken)
    {
        await application.SetBindingAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadActor(context),
            environmentName,
            name,
            request.Reference,
            cancellationToken).ConfigureAwait(false);
        return Results.NoContent();
    }

    private static async Task<IResult> ActivateAsync(
        HttpContext context,
        string environmentName,
        string managedDefinitionName,
        ActivationRequest request,
        PromotionApplication application,
        IAuthorizationService authorization,
        CancellationToken cancellationToken)
    {
        string? approvedBy = await ReadApprovalAsync(
            context,
            authorization,
            environmentName).ConfigureAwait(false);
        ActivationResult result = await application.ActivateAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadActor(context),
            environmentName,
            managedDefinitionName,
            request.ReleaseDigest,
            WorkflowRequestContext.ReadExpectedVersion(context),
            approvedBy,
            cancellationToken).ConfigureAwait(false);
        context.Response.Headers.ETag = $"\"{result.Version}\"";
        return Results.Ok(result);
    }

    private static async Task<string?> ReadApprovalAsync(
        HttpContext context,
        IAuthorizationService authorization,
        string environmentName)
    {
        if (!string.Equals(environmentName, "production", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }
        AuthorizationResult approval = await authorization.AuthorizeAsync(
            context.User,
            resource: null,
            KajayPolicies.DefinitionApprove).ConfigureAwait(false);
        if (!approval.Succeeded)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status403Forbidden,
                "production-approval-forbidden",
                $"Production activation requires '{KajayPermissions.DefinitionApprove}'.");
        }
        return WorkflowRequestContext.ReadActor(context);
    }
}
