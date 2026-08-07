using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication(WorkflowDbContext database)
{
    private readonly WorkflowDbContext _database = database;

    internal async Task<DefinitionProvenanceResult> GetAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        ValidateName(environmentName, nameof(environmentName));
        ManagedDefinitionRecord definition = await _database.ManagedDefinitions.AsNoTracking()
            .SingleOrDefaultAsync(item => item.TenantId == tenantId
                && item.Name == managedDefinitionName, cancellationToken).ConfigureAwait(false)
            ?? throw new WorkflowProblemException(
                StatusCodes.Status404NotFound,
                "managed-definition-not-found",
                $"Managed Definition '{managedDefinitionName}' does not exist.");
        RevisionFact[] revisions = await LoadRevisionsAsync(
            tenantId, managedDefinitionName, cancellationToken).ConfigureAwait(false);
        ReleaseFact[] releases = await LoadReleasesAsync(
            tenantId, managedDefinitionName, cancellationToken).ConfigureAwait(false);
        DefinitionReleaseProvenanceRecord[] links = await LoadLinksAsync(
            tenantId, managedDefinitionName, cancellationToken).ConfigureAwait(false);
        ActivationRecord? activation = await LoadActivationAsync(
            tenantId, managedDefinitionName, environmentName, cancellationToken)
            .ConfigureAwait(false);
        string[] bindings = await LoadBindingsAsync(
            tenantId, environmentName, cancellationToken).ConfigureAwait(false);
        ManagementAuditEventRecord[] audit = await LoadAuditAsync(
            tenantId, managedDefinitionName, environmentName, releases, cancellationToken)
            .ConfigureAwait(false);
        ManagementAuditEventRecord[] activationAudit = await LoadActivationAuditAsync(
            tenantId, managedDefinitionName, environmentName, cancellationToken)
            .ConfigureAwait(false);
        ActivationAuditFact[] activationHistory = ReadActivationHistory(
            activationAudit, environmentName, managedDefinitionName);
        string[] environments = await LoadEnvironmentsAsync(
            tenantId, environmentName, cancellationToken).ConfigureAwait(false);

        return new DefinitionProvenanceResult(
            definition.Name,
            definition.CreatedBy,
            definition.CreatedAt,
            environmentName,
            environments,
            ToActivationResult(activation, releases, activationHistory),
            ToRevisionResults(revisions, links),
            ToReleaseResults(releases, links, bindings, activation, activationHistory),
            audit.Select(ToAuditResult).ToArray());
    }

    private async Task<RevisionFact[]> LoadRevisionsAsync(
        string tenantId,
        string managedDefinitionName,
        CancellationToken cancellationToken) =>
        await _database.DefinitionRevisions.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName)
            .OrderByDescending(item => item.Number)
            .Select(item => new RevisionFact(
                item.Number,
                item.SourceDraftVersion,
                item.DefinitionDigest,
                item.CreatedBy,
                item.CreatedAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);

    private async Task<ReleaseFact[]> LoadReleasesAsync(
        string tenantId,
        string managedDefinitionName,
        CancellationToken cancellationToken) =>
        await _database.DefinitionReleases.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName)
            .OrderByDescending(item => item.InstalledAt)
            .Select(item => new ReleaseFact(
                item.Digest,
                item.VersionLabel,
                item.ConformanceVersion,
                item.RequiredBindings,
                item.InstalledAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);

    private async Task<DefinitionReleaseProvenanceRecord[]> LoadLinksAsync(
        string tenantId,
        string managedDefinitionName,
        CancellationToken cancellationToken) =>
        await _database.DefinitionReleaseProvenance.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);

    private async Task<ActivationRecord?> LoadActivationAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
        CancellationToken cancellationToken) =>
        await _database.Activations.AsNoTracking().SingleOrDefaultAsync(
            item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName
                && item.EnvironmentName == environmentName,
            cancellationToken).ConfigureAwait(false);

    private async Task<string[]> LoadBindingsAsync(
        string tenantId,
        string environmentName,
        CancellationToken cancellationToken) =>
        await _database.EnvironmentBindings.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.EnvironmentName == environmentName)
            .Select(item => item.Name)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);

    private async Task<string[]> LoadEnvironmentsAsync(
        string tenantId,
        string selectedEnvironment,
        CancellationToken cancellationToken)
    {
        string[] activated = await _database.Activations.AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Select(item => item.EnvironmentName).Distinct()
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        string[] bound = await _database.EnvironmentBindings.AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Select(item => item.EnvironmentName).Distinct()
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        return activated.Append(selectedEnvironment).Concat(bound)
            .Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
    }

    private static void ValidateName(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-name",
                $"{parameterName} must contain 1 to 128 characters.");
        }
    }
}
