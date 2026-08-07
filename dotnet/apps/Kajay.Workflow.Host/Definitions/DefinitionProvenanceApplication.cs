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
        string[] environments = await LoadEnvironmentsAsync(
            tenantId, environmentName, cancellationToken).ConfigureAwait(false);
        ManagedDefinitionRecord definition = await LoadDefinitionAsync(
            tenantId, managedDefinitionName, cancellationToken).ConfigureAwait(false);
        ActivationRecord? activation = await LoadActivationAsync(
            tenantId, managedDefinitionName, environmentName, cancellationToken)
            .ConfigureAwait(false);
        string[] bindings = await LoadBindingsAsync(
            tenantId, environmentName, cancellationToken).ConfigureAwait(false);
        ActivationAuditFact[] activationHistory = activation is null
            ? []
            : await LoadActivationHistoryAsync(
                tenantId, managedDefinitionName, environmentName,
                [activation.ReleaseDigest], cancellationToken).ConfigureAwait(false);
        string? activeVersionLabel = await LoadActiveVersionLabelAsync(
            tenantId, activation, cancellationToken).ConfigureAwait(false);
        CursorPageResult<DefinitionRevisionHistoryResult> revisions = await LoadRevisionPageAsync(
            tenantId, managedDefinitionName, new RevisionHistoryPageQuery(null, null, null),
            cancellationToken).ConfigureAwait(false);
        CursorPageResult<DefinitionReleaseHistoryResult> releases = await LoadReleasePageAsync(
            tenantId, managedDefinitionName,
            new ReleaseHistoryPageQuery(environmentName, null, null, null, null),
            bindings, activation, cancellationToken).ConfigureAwait(false);
        CursorPageResult<ManagementAuditEventResult> audit = await LoadAuditPageAsync(
            tenantId, managedDefinitionName,
            new AuditHistoryPageQuery(environmentName, null, null, null), cancellationToken)
            .ConfigureAwait(false);
        return new DefinitionProvenanceResult(
            definition.Name,
            definition.CreatedBy,
            definition.CreatedAt,
            environmentName,
            environments,
            ToActivationResult(activation, activeVersionLabel, activationHistory),
            revisions,
            releases,
            audit);
    }

    private async Task<ManagedDefinitionRecord> LoadDefinitionAsync(
        string tenantId,
        string managedDefinitionName,
        CancellationToken cancellationToken) =>
        await _database.ManagedDefinitions.AsNoTracking()
            .SingleOrDefaultAsync(item => item.TenantId == tenantId
                && item.Name == managedDefinitionName, cancellationToken).ConfigureAwait(false)
            ?? throw new WorkflowProblemException(
                StatusCodes.Status404NotFound,
                "managed-definition-not-found",
                $"Managed Definition '{managedDefinitionName}' does not exist.");

    private async Task<string?> LoadActiveVersionLabelAsync(
        string tenantId,
        ActivationRecord? activation,
        CancellationToken cancellationToken)
    {
        if (activation is null)
        {
            return null;
        }
        return await _database.DefinitionReleases.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.Digest == activation.ReleaseDigest)
            .Select(item => item.VersionLabel)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
    }

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
        string[] environments = await _database.Environments.AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .OrderBy(item => item.Position)
            .ThenBy(item => item.Name)
            .Select(item => item.Name)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        if (!environments.Contains(selectedEnvironment, StringComparer.Ordinal))
        {
            throw new WorkflowProblemException(
                StatusCodes.Status404NotFound,
                "environment-not-found",
                $"Environment '{selectedEnvironment}' does not exist.");
        }
        return environments;
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
