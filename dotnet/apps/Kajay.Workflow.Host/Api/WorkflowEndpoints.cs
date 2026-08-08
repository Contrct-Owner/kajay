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
        api.MapGet("/instances/{instanceId:guid}/submissions", GetSubmissionsAsync)
            .RequireAuthorization(KajayPolicies.WorkflowRead);
        api.MapGet("/instances/{instanceId:guid}/reviews", GetReviewTasksAsync)
            .RequireAuthorization(KajayPolicies.WorkflowRead);
        api.MapGet("/reviews", GetReviewTaskPageAsync)
            .RequireAuthorization(KajayPolicies.WorkflowReview);
        api.MapGet("/reviews/{reviewTaskId:guid}", GetReviewTaskDetailAsync)
            .RequireAuthorization(KajayPolicies.WorkflowReview);
        api.MapGet("/instances/{instanceId:guid}/work", GetWorkAsync)
            .RequireAuthorization(KajayPolicies.WorkflowRead);
        api.MapPut("/instances/{instanceId:guid}/response", SaveResponseAsync)
            .RequireAuthorization(KajayPolicies.WorkflowExecute);
        api.MapPost("/instances/{instanceId:guid}/complete", CompleteSurveyAsync)
            .RequireAuthorization(KajayPolicies.WorkflowExecute);
        api.MapPost(
            "/instances/{instanceId:guid}/reviews/{reviewTaskId:guid}/decisions",
            DecideReviewAsync).RequireAuthorization(KajayPolicies.WorkflowReview);
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

    private static async Task<IResult> GetSubmissionsAsync(
        HttpContext context,
        Guid instanceId,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<SurveySubmissionResult> result = await application.GetSubmissionsAsync(
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

    private static async Task<IResult> GetReviewTasksAsync(
        HttpContext context,
        Guid instanceId,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ReviewTaskResult> result = await application.GetReviewTasksAsync(
            WorkflowRequestContext.ReadTenant(context),
            instanceId,
            cancellationToken).ConfigureAwait(false);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetReviewTaskPageAsync(
        HttpContext context,
        [AsParameters] ReviewTaskPageQuery query,
        ReviewWorkbenchApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.GetPageAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadPrincipal(context),
            query,
            cancellationToken).ConfigureAwait(false));

    private static async Task<IResult> GetReviewTaskDetailAsync(
        HttpContext context,
        Guid reviewTaskId,
        ReviewWorkbenchApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.GetDetailAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadPrincipal(context),
            reviewTaskId,
            cancellationToken).ConfigureAwait(false));

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

    private static async Task<IResult> DecideReviewAsync(
        HttpContext context,
        Guid instanceId,
        Guid reviewTaskId,
        ReviewDecisionRequest request,
        WorkflowApplication application,
        CancellationToken cancellationToken)
    {
        WorkflowInstanceResult result = await application.DecideReviewAsync(
            WorkflowRequestContext.ReadTenant(context),
            WorkflowRequestContext.ReadPrincipal(context),
            instanceId,
            reviewTaskId,
            WorkflowRequestContext.ReadExpectedVersion(context),
            WorkflowRequestContext.ReadIdempotencyKey(context),
            request,
            cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static void SetEtag(HttpContext context, long version)
    {
        context.Response.Headers.ETag = $"\"{version}\"";
    }
}
