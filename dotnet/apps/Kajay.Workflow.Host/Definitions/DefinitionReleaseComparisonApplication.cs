using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed class DefinitionReleaseComparisonApplication(WorkflowDbContext database)
{
    internal async Task<DefinitionReleaseComparisonResult> GetAsync(
        string tenantId,
        string managedDefinitionName,
        string targetDigest,
        ReleaseComparisonQuery request,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        ValidateName(request.EnvironmentName, nameof(request.EnvironmentName));
        await RequireEnvironmentAsync(
            tenantId, request.EnvironmentName, cancellationToken).ConfigureAwait(false);
        DefinitionReleaseRecord target = await LoadReleaseAsync(
            tenantId, managedDefinitionName, targetDigest, "target", cancellationToken)
            .ConfigureAwait(false);
        string? baselineDigest = request.BaselineDigest ?? await LoadActiveDigestAsync(
            tenantId, managedDefinitionName, request.EnvironmentName, cancellationToken)
            .ConfigureAwait(false);
        DefinitionReleaseRecord? baseline = baselineDigest is null
            ? null
            : await LoadReleaseAsync(
                tenantId, managedDefinitionName, baselineDigest, "baseline", cancellationToken)
                .ConfigureAwait(false);
        return Compare(request.EnvironmentName, baseline, target);
    }

    private async Task RequireEnvironmentAsync(
        string tenantId,
        string environmentName,
        CancellationToken cancellationToken)
    {
        bool exists = await database.Environments.AsNoTracking().AnyAsync(
            item => item.TenantId == tenantId && item.Name == environmentName,
            cancellationToken).ConfigureAwait(false);
        if (!exists)
        {
            throw Problem(StatusCodes.Status404NotFound, "environment-not-found",
                $"Environment '{environmentName}' does not exist.");
        }
    }

    private async Task<DefinitionReleaseRecord> LoadReleaseAsync(
        string tenantId,
        string managedDefinitionName,
        string digest,
        string role,
        CancellationToken cancellationToken) =>
        await database.DefinitionReleases.AsNoTracking().SingleOrDefaultAsync(
            item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName
                && item.Digest == digest,
            cancellationToken).ConfigureAwait(false)
        ?? throw Problem(StatusCodes.Status404NotFound, $"{role}-release-not-found",
            $"The {role} release '{digest}' does not exist for '{managedDefinitionName}'.");

    private async Task<string?> LoadActiveDigestAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
        CancellationToken cancellationToken) =>
        await database.Activations.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName
                && item.EnvironmentName == environmentName)
            .Select(item => item.ReleaseDigest)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);

    private static DefinitionReleaseComparisonResult Compare(
        string environmentName,
        DefinitionReleaseRecord? baseline,
        DefinitionReleaseRecord target)
    {
        DefinitionReleaseDifference difference = baseline is null
            ? new DefinitionReleaseDifference([], false)
            : DefinitionReleaseDiffer.Compare(
                DefinitionReleaseArtifact.Create(baseline),
                DefinitionReleaseArtifact.Create(target));
        int added = difference.Changes.Count(item => item.Kind == "added");
        int removed = difference.Changes.Count(item => item.Kind == "removed");
        int changed = difference.Changes.Count(item => item.Kind == "changed");
        return new DefinitionReleaseComparisonResult(
            environmentName,
            baseline is null ? null : ToTarget(baseline),
            ToTarget(target),
            baseline is null,
            new DefinitionReleaseChangeSummaryResult(
                added, removed, changed, difference.Changes.Count),
            difference.Changes,
            difference.Truncated);
    }

    private static DefinitionReleaseComparisonTargetResult ToTarget(
        DefinitionReleaseRecord release) => new(release.Digest, release.VersionLabel);

    private static void ValidateName(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-name",
                $"{parameterName} must contain 1 to 128 characters.");
        }
    }

    private static WorkflowProblemException Problem(int status, string code, string message) =>
        new(status, code, message);
}
