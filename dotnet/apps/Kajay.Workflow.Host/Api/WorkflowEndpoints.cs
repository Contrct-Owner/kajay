using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Workflows;

namespace Kajay.Workflow.Host.Api;

internal static class WorkflowEndpoints
{
    internal static IEndpointRouteBuilder MapWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder api = endpoints.MapGroup("/api");
        api.MapPost(
            "/environments/{environmentName}/definitions/{managedDefinitionName}/instances",
            StartAsync).RequireAuthorization(KajayPolicies.WorkflowExecute);
        api.MapGet("/instances/{instanceId:guid}", GetAsync)
            .RequireAuthorization(KajayPolicies.WorkflowRead);
        api.MapGet("/instances/{instanceId:guid}/audit", GetAuditAsync)
            .RequireAuthorization(KajayPolicies.WorkflowRead);
        api.MapGet("/instances/{instanceId:guid}/work", GetWorkAsync)
            .RequireAuthorization(KajayPolicies.WorkflowRead);
        api.MapPut("/instances/{instanceId:guid}/response", SaveResponseAsync)
            .RequireAuthorization(KajayPolicies.WorkflowExecute);
        api.MapPost("/instances/{instanceId:guid}/complete", CompleteSurveyAsync)
            .RequireAuthorization(KajayPolicies.WorkflowExecute);
        return endpoints;
    }

    private static async Task<IResult> StartAsync(
        HttpContext context,
        string environmentName,
        string managedDefinitionName,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult result = await application.StartAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadActor(context),
            environmentName,
            managedDefinitionName,
            WorkflowRequestContext.ReadIdempotencyKey(context),
            cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Created($"/api/instances/{result.Id}", result);
    }

    private static async Task<IResult> GetAsync(
        HttpContext context,
        Guid instanceId,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult result = await application.GetAsync(
            WorkflowRequestContext.ReadTenant(context),
            instanceId,
            cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetAuditAsync(
        HttpContext context,
        Guid instanceId,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<WorkflowAuditEventResult> result = await application.GetAuditAsync(
            WorkflowRequestContext.ReadTenant(context),
            instanceId,
            cancellationToken).ConfigureAwait(false);
        return Results.Ok(result);
    }

    private static async Task<IResult> SaveResponseAsync(
        HttpContext context,
        Guid instanceId,
        SaveResponseRequest request,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult result = await application.SaveResponseAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadActor(context),
            instanceId,
            WorkflowRequestContext.ReadExpectedVersion(context),
            WorkflowRequestContext.ReadIdempotencyKey(context),
            request.Snapshot.GetRawText(),
            cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetWorkAsync(
        HttpContext context,
        Guid instanceId,
        WorkflowOperationsApplication application,
        CancellationToken cancellationToken)
    {
        WorkflowWorkResult result = await application.GetWorkAsync(
            WorkflowRequestContext.ReadTenant(context),
            instanceId,
            cancellationToken).ConfigureAwait(false);
        return Results.Ok(result);
    }

    private static async Task<IResult> CompleteSurveyAsync(
        HttpContext context,
        Guid instanceId,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult result = await application.CompleteSurveyAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadActor(context),
            instanceId,
            WorkflowRequestContext.ReadExpectedVersion(context),
            WorkflowRequestContext.ReadIdempotencyKey(context),
            cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static void SetEtag(HttpContext context, long version)
    {
        context.Response.Headers.ETag = $"\"{version}\"";
    }
}
