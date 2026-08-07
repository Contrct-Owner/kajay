using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Definitions;

namespace Kajay.Workflow.Host.Api;

internal static class EnvironmentEndpoints
{
    internal static IEndpointRouteBuilder MapEnvironmentEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder environments = endpoints.MapGroup("/api/management/environments");
        environments.MapGet("/", ListAsync)
            .RequireAuthorization(KajayPolicies.DefinitionManage);
        environments.MapPost("/", CreateAsync)
            .RequireAuthorization(KajayPolicies.EnvironmentManage);
        environments.MapPut("/{environmentName}", UpdateAsync)
            .RequireAuthorization(KajayPolicies.EnvironmentManage);
        environments.MapGet("/{environmentName}/bindings", ListBindingsAsync)
            .RequireAuthorization(KajayPolicies.DefinitionManage);
        environments.MapPut("/{environmentName}/bindings/{bindingName}", SetBindingAsync)
            .RequireAuthorization(KajayPolicies.EnvironmentManage);
        environments.MapDelete("/{environmentName}/bindings/{bindingName}", RemoveBindingAsync)
            .RequireAuthorization(KajayPolicies.EnvironmentManage);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        HttpContext context,
        EnvironmentApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.ListAsync(
            WorkflowRequestContext.ReadTenant(context), cancellationToken).ConfigureAwait(false));

    private static async Task<IResult> CreateAsync(
        HttpContext context,
        CreateEnvironmentRequest request,
        EnvironmentApplication application,
        CancellationToken cancellationToken)
    {
        EnvironmentResult result = await application.CreateAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            request, cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Created($"/api/management/environments/{result.Name}", result);
    }

    private static async Task<IResult> UpdateAsync(
        HttpContext context,
        string environmentName,
        UpdateEnvironmentRequest request,
        EnvironmentApplication application,
        CancellationToken cancellationToken)
    {
        EnvironmentResult result = await application.UpdateAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            environmentName, WorkflowRequestContext.ReadExpectedVersion(context), request,
            cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static async Task<IResult> ListBindingsAsync(
        HttpContext context,
        string environmentName,
        EnvironmentApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.ListBindingsAsync(
            WorkflowRequestContext.ReadTenant(context), environmentName, cancellationToken)
            .ConfigureAwait(false));

    private static async Task<IResult> SetBindingAsync(
        HttpContext context,
        string environmentName,
        string bindingName,
        EnvironmentBindingRequest request,
        EnvironmentApplication application,
        CancellationToken cancellationToken)
    {
        EnvironmentBindingResult result = await application.SetBindingAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            environmentName, bindingName, request.Reference,
            WorkflowRequestContext.ReadExpectedVersion(context), cancellationToken)
            .ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static async Task<IResult> RemoveBindingAsync(
        HttpContext context,
        string environmentName,
        string bindingName,
        EnvironmentApplication application,
        CancellationToken cancellationToken)
    {
        await application.RemoveBindingAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            environmentName, bindingName, WorkflowRequestContext.ReadExpectedVersion(context),
            cancellationToken).ConfigureAwait(false);
        return Results.NoContent();
    }

    private static void SetEtag(HttpContext context, long version) =>
        context.Response.Headers.ETag = $"\"{version}\"";
}
