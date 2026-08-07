using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Definitions;

namespace Kajay.Workflow.Host.Api;

internal static class DefinitionAuthoringEndpoints
{
    internal static IEndpointRouteBuilder MapDefinitionAuthoringEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder definitions = endpoints.MapGroup("/api/management/definitions")
            .RequireAuthorization(KajayPolicies.DefinitionManage);
        definitions.MapGet("/{managedDefinitionName}/draft", GetDraftAsync);
        definitions.MapGet("/{managedDefinitionName}/provenance", GetProvenanceAsync);
        definitions.MapGet("/{managedDefinitionName}/provenance/revisions", GetRevisionsAsync);
        definitions.MapGet("/{managedDefinitionName}/provenance/releases", GetReleasesAsync);
        definitions.MapGet("/{managedDefinitionName}/provenance/audit", GetAuditAsync);
        definitions.MapPut("/{managedDefinitionName}/draft", SaveDraftAsync);
        definitions.MapPost("/{managedDefinitionName}/revisions", CheckpointAsync);
        definitions.MapPost("/{managedDefinitionName}/revisions/{revisionNumber:long}/releases",
            CreateReleaseAsync).RequireAuthorization(KajayPolicies.DefinitionPromote);
        return endpoints;
    }

    private static async Task<IResult> GetRevisionsAsync(
        HttpContext context,
        string managedDefinitionName,
        [AsParameters] RevisionHistoryPageQuery query,
        DefinitionProvenanceApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.GetRevisionsAsync(
            WorkflowRequestContext.ReadTenant(context), managedDefinitionName, query,
            cancellationToken).ConfigureAwait(false));

    private static async Task<IResult> GetReleasesAsync(
        HttpContext context,
        string managedDefinitionName,
        [AsParameters] ReleaseHistoryPageQuery query,
        DefinitionProvenanceApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.GetReleasesAsync(
            WorkflowRequestContext.ReadTenant(context), managedDefinitionName, query,
            cancellationToken).ConfigureAwait(false));

    private static async Task<IResult> GetAuditAsync(
        HttpContext context,
        string managedDefinitionName,
        [AsParameters] AuditHistoryPageQuery query,
        DefinitionProvenanceApplication application,
        CancellationToken cancellationToken) =>
        Results.Ok(await application.GetAuditAsync(
            WorkflowRequestContext.ReadTenant(context), managedDefinitionName, query,
            cancellationToken).ConfigureAwait(false));

    private static async Task<IResult> GetProvenanceAsync(
        HttpContext context,
        string managedDefinitionName,
        string environmentName,
        DefinitionProvenanceApplication application,
        CancellationToken cancellationToken)
    {
        DefinitionProvenanceResult result = await application.GetAsync(
            WorkflowRequestContext.ReadTenant(context),
            managedDefinitionName,
            environmentName,
            cancellationToken).ConfigureAwait(false);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetDraftAsync(
        HttpContext context,
        string managedDefinitionName,
        DefinitionAuthoringApplication application,
        CancellationToken cancellationToken)
    {
        DefinitionDraftResult result = await application.GetDraftAsync(
            WorkflowRequestContext.ReadTenant(context), managedDefinitionName, cancellationToken)
            .ConfigureAwait(false);
        SetEtag(context, result.Version);
        return Results.Ok(result);
    }

    private static async Task<IResult> SaveDraftAsync(
        HttpContext context,
        string managedDefinitionName,
        SaveDefinitionDraftRequest request,
        DefinitionAuthoringApplication application,
        CancellationToken cancellationToken)
    {
        DefinitionDraftResult result = await application.SaveDraftAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            managedDefinitionName, WorkflowRequestContext.ReadExpectedVersion(context),
            request.Definition, cancellationToken).ConfigureAwait(false);
        SetEtag(context, result.Version);
        return result.Created
            ? Results.Created($"/api/management/definitions/{managedDefinitionName}/draft", result)
            : Results.Ok(result);
    }

    private static async Task<IResult> CheckpointAsync(
        HttpContext context,
        string managedDefinitionName,
        DefinitionAuthoringApplication application,
        CancellationToken cancellationToken)
    {
        DefinitionRevisionResult result = await application.CheckpointAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            managedDefinitionName, WorkflowRequestContext.ReadExpectedVersion(context),
            cancellationToken).ConfigureAwait(false);
        return result.Created
            ? Results.Created($"/api/management/definitions/{managedDefinitionName}/revisions/{result.Number}", result)
            : Results.Ok(result);
    }

    private static async Task<IResult> CreateReleaseAsync(
        HttpContext context,
        string managedDefinitionName,
        long revisionNumber,
        CreateDefinitionReleaseRequest request,
        DefinitionAuthoringApplication application,
        CancellationToken cancellationToken)
    {
        ReleaseInstallResult result = await application.CreateReleaseAsync(
            WorkflowRequestContext.ReadTenant(context), WorkflowRequestContext.ReadActor(context),
            managedDefinitionName, revisionNumber, request, cancellationToken).ConfigureAwait(false);
        return result.Installed
            ? Results.Created($"/api/management/releases/{result.Digest}", result)
            : Results.Ok(result);
    }

    private static void SetEtag(HttpContext context, long version) =>
        context.Response.Headers.ETag = $"\"{version}\"";
}
