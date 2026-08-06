using System.Text.Json;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class PromotionApplication
{
    private readonly WorkflowDbContext _database;
    private readonly TimeProvider _timeProvider;

    public PromotionApplication(WorkflowDbContext database, TimeProvider timeProvider)
    {
        _database = database;
        _timeProvider = timeProvider;
    }

    internal async Task<ReleasePreflightResult> PreflightAsync(
        string tenantId,
        string environmentName,
        ReadOnlyMemory<byte> bundle,
        CancellationToken cancellationToken)
    {
        DefinitionReleaseContent content = ReadBundle(bundle);
        ValidateCompatibility(content);
        IReadOnlyList<string> missingBindings = await FindMissingBindingsAsync(
            tenantId,
            environmentName,
            content.RequiredBindings,
            cancellationToken).ConfigureAwait(false);
        return new ReleasePreflightResult(
            DefinitionReleaseDigest.Compute(content),
            content.ManagedDefinitionName,
            content.VersionLabel,
            missingBindings.Count == 0,
            missingBindings);
    }

    internal async Task<ReleaseInstallResult> InstallAsync(
        string tenantId,
        string actorId,
        ReadOnlyMemory<byte> bundle,
        CancellationToken cancellationToken)
    {
        DefinitionReleaseContent content = ReadBundle(bundle);
        ValidateCompatibility(content);
        string digest = DefinitionReleaseDigest.Compute(content);
        await using IDbContextTransaction transaction = await BeginManagementLockAsync(
            $"install:{tenantId}:{content.ManagedDefinitionName}:{content.VersionLabel}",
            cancellationToken).ConfigureAwait(false);
        DefinitionReleaseRecord? existing = await _database.DefinitionReleases
            .AsNoTracking()
            .SingleOrDefaultAsync(
                release => release.TenantId == tenantId && release.Digest == digest,
                cancellationToken).ConfigureAwait(false);
        if (existing is not null)
        {
            return ToInstallResult(existing, installed: false);
        }

        DefinitionReleaseRecord? labelOwner = await _database.DefinitionReleases
            .AsNoTracking()
            .SingleOrDefaultAsync(
                release => release.TenantId == tenantId
                    && release.ManagedDefinitionName == content.ManagedDefinitionName
                    && release.VersionLabel == content.VersionLabel,
                cancellationToken).ConfigureAwait(false);
        if (labelOwner is not null)
        {
            throw Problem(
                StatusCodes.Status409Conflict,
                "release-label-conflict",
                $"Version label '{content.VersionLabel}' already names release "
                    + $"'{labelOwner.Digest}'.");
        }

        DateTimeOffset now = _timeProvider.GetUtcNow();
        DefinitionReleaseRecord release = DefinitionReleaseStorage.ToRecord(
            tenantId,
            content,
            bundle.ToArray(),
            now);
        _database.DefinitionReleases.Add(release);
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            Subject = release.Digest,
            EventType = "definition-release-installed",
            PayloadJson = JsonSerializer.Serialize(new
            {
                release.ManagedDefinitionName,
                release.VersionLabel,
                release.ConformanceVersion,
            }),
            ActorId = actorId,
            OccurredAt = now,
        });
        await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToInstallResult(release, installed: true);
    }

    internal async Task<byte[]> ExportAsync(
        string tenantId,
        string releaseDigest,
        CancellationToken cancellationToken)
    {
        return await _database.DefinitionReleases
            .Where(release => release.TenantId == tenantId && release.Digest == releaseDigest)
            .Select(release => release.Bundle)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false)
            ?? throw Problem(
                StatusCodes.Status404NotFound,
                "release-not-installed",
                $"Definition release '{releaseDigest}' is not installed.");
    }

    private async Task<IReadOnlyList<string>> FindMissingBindingsAsync(
        string tenantId,
        string environmentName,
        IReadOnlyCollection<string> required,
        CancellationToken cancellationToken)
    {
        if (required.Count == 0)
        {
            return [];
        }
        string[] present = await _database.EnvironmentBindings
            .Where(binding => binding.TenantId == tenantId
                && binding.EnvironmentName == environmentName
                && required.Contains(binding.Name))
            .Select(binding => binding.Name)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        return required.Except(present, StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
    }

    private static DefinitionReleaseContent ReadBundle(ReadOnlyMemory<byte> bundle)
    {
        try
        {
            return KajayBundle.Read(bundle);
        }
        catch (Exception exception) when (exception is InvalidDataException or JsonException)
        {
            throw Problem(
                StatusCodes.Status400BadRequest,
                "invalid-kajay-bundle",
                exception.Message,
                exception);
        }
    }

    private static void ValidateCompatibility(DefinitionReleaseContent content)
    {
        if (!Kajay.KajayContracts.SupportedConformanceVersions.Contains(
            content.ConformanceVersion))
        {
            throw Problem(
                StatusCodes.Status422UnprocessableEntity,
                "unsupported-conformance-version",
                $"Conformance version {content.ConformanceVersion} is not supported.");
        }
    }

    private static ReleaseInstallResult ToInstallResult(
        DefinitionReleaseRecord release,
        bool installed)
    {
        return new ReleaseInstallResult(
            release.Digest,
            release.ManagedDefinitionName,
            release.VersionLabel,
            installed);
    }

    private async Task<IDbContextTransaction> BeginManagementLockAsync(
        string key,
        CancellationToken cancellationToken)
    {
        IDbContextTransaction transaction = await _database.Database
            .BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _ = await _database.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))",
                cancellationToken).ConfigureAwait(false);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private static WorkflowProblemException Problem(
        int status,
        string code,
        string message,
        Exception? innerException = null)
    {
        return innerException is null
            ? new WorkflowProblemException(status, code, message)
            : new WorkflowProblemException(status, code, $"{message} ({innerException.GetType().Name})");
    }
}
