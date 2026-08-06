using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowReleaseResolver(WorkflowDbContext database)
{
    internal async Task<WorkflowRelease> ResolveActiveAsync(
        string tenantId,
        string environmentName,
        string managedDefinitionName,
        CancellationToken cancellationToken)
    {
        ActivationRecord activation = await database.Activations
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.TenantId == tenantId
                    && item.EnvironmentName == environmentName
                    && item.ManagedDefinitionName == managedDefinitionName,
                cancellationToken).ConfigureAwait(false)
            ?? throw Problem(
                "definition-not-active",
                $"Managed Definition '{managedDefinitionName}' is not active in "
                    + $"'{environmentName}'.");
        return await ResolveAsync(tenantId, activation.ReleaseDigest, cancellationToken)
            .ConfigureAwait(false);
    }

    internal async Task<WorkflowRelease> ResolveAsync(
        string tenantId,
        string releaseDigest,
        CancellationToken cancellationToken)
    {
        DefinitionReleaseRecord release = await database.DefinitionReleases
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.TenantId == tenantId && item.Digest == releaseDigest,
                cancellationToken).ConfigureAwait(false)
            ?? throw Problem(
                "release-not-installed",
                $"Definition release '{releaseDigest}' is not installed.");
        return new WorkflowRelease(release);
    }

    private static WorkflowProblemException Problem(string code, string message)
    {
        return new WorkflowProblemException(StatusCodes.Status404NotFound, code, message);
    }
}
