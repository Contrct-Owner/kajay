using System.Text.Json;
using Kajay;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionAuthoringApplication
{
    internal async Task<DefinitionRevisionResult> CheckpointAsync(
        string tenantId,
        string actorId,
        string managedDefinitionName,
        long expectedDraftVersion,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"revision:{tenantId}:{managedDefinitionName}", cancellationToken)
            .ConfigureAwait(false);
        DefinitionDraftRecord draft = await LoadDraftAsync(
            tenantId, managedDefinitionName, cancellationToken).ConfigureAwait(false)
            ?? throw Problem(StatusCodes.Status404NotFound, "definition-draft-not-found",
                $"Managed Definition '{managedDefinitionName}' has no draft.");
        RequireVersion(expectedDraftVersion, draft.Version, "definition-draft-version-conflict");
        DefinitionRevisionRecord? existing = await FindRevisionAsync(
            tenantId, managedDefinitionName, draft.Version, cancellationToken)
            .ConfigureAwait(false);
        bool created = existing is null;
        DefinitionRevisionRecord revision = existing
            ?? await CreateRevisionAsync(tenantId, actorId, draft, cancellationToken)
                .ConfigureAwait(false);
        if (created)
        {
            await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToRevisionResult(revision, created);
    }

    internal async Task<ReleaseInstallResult> CreateReleaseAsync(
        string tenantId,
        string actorId,
        string managedDefinitionName,
        long revisionNumber,
        CreateDefinitionReleaseRequest request,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        DefinitionRevisionRecord revision = await _database.DefinitionRevisions.AsNoTracking()
            .SingleOrDefaultAsync(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName
                && item.Number == revisionNumber, cancellationToken).ConfigureAwait(false)
            ?? throw Problem(StatusCodes.Status404NotFound, "definition-revision-not-found",
                $"Revision {revisionNumber} of '{managedDefinitionName}' does not exist.");
        DefinitionReleaseContent content = AssembleRelease(revision, request);
        ReleaseInstallResult result = await _promotion.InstallAsync(
            tenantId, actorId, KajayBundle.Write(content), cancellationToken).ConfigureAwait(false);
        await LinkReleaseAsync(tenantId, actorId, revision, result, cancellationToken)
            .ConfigureAwait(false);
        return result;
    }

    private async Task LinkReleaseAsync(
        string tenantId,
        string actorId,
        DefinitionRevisionRecord revision,
        ReleaseInstallResult release,
        CancellationToken cancellationToken)
    {
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"release-provenance:{tenantId}:{release.Digest}:{revision.Number}",
            cancellationToken).ConfigureAwait(false);
        bool exists = await _database.DefinitionReleaseProvenance.AnyAsync(
            item => item.TenantId == tenantId
                && item.ReleaseDigest == release.Digest
                && item.ManagedDefinitionName == revision.ManagedDefinitionName
                && item.RevisionNumber == revision.Number,
            cancellationToken).ConfigureAwait(false);
        if (!exists)
        {
            DateTimeOffset now = _timeProvider.GetUtcNow();
            _database.DefinitionReleaseProvenance.Add(new DefinitionReleaseProvenanceRecord
            {
                TenantId = tenantId,
                ReleaseDigest = release.Digest,
                ManagedDefinitionName = revision.ManagedDefinitionName,
                RevisionNumber = revision.Number,
                LinkedBy = actorId,
                LinkedAt = now,
            });
            AppendReleaseAudit(tenantId, actorId, revision, release);
            await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<DefinitionRevisionRecord?> FindRevisionAsync(
        string tenantId,
        string managedDefinitionName,
        long draftVersion,
        CancellationToken cancellationToken)
    {
        return await _database.DefinitionRevisions.AsNoTracking().SingleOrDefaultAsync(
            item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName
                && item.SourceDraftVersion == draftVersion,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<DefinitionRevisionRecord> CreateRevisionAsync(
        string tenantId,
        string actorId,
        DefinitionDraftRecord draft,
        CancellationToken cancellationToken)
    {
        long number = await _database.DefinitionRevisions
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == draft.ManagedDefinitionName)
            .Select(item => (long?)item.Number).MaxAsync(cancellationToken).ConfigureAwait(false)
            ?? 0;
        DateTimeOffset now = _timeProvider.GetUtcNow();
        var revision = new DefinitionRevisionRecord
        {
            TenantId = tenantId,
            ManagedDefinitionName = draft.ManagedDefinitionName,
            Number = number + 1,
            SourceDraftVersion = draft.Version,
            DefinitionJson = draft.DefinitionJson,
            DefinitionDigest = draft.DefinitionDigest,
            CreatedBy = actorId,
            CreatedAt = now,
        };
        _database.DefinitionRevisions.Add(revision);
        AppendAudit(tenantId, actorId, draft.ManagedDefinitionName,
            "definition-revision-created", revision.Number, now);
        return revision;
    }

    private static DefinitionReleaseContent AssembleRelease(
        DefinitionRevisionRecord revision,
        CreateDefinitionReleaseRequest request)
    {
        ValidateName(request.VersionLabel, nameof(request.VersionLabel));
        IReadOnlyList<string?> authoredBindings = request.RequiredBindings ?? [];
        if (authoredBindings.Any(binding => string.IsNullOrWhiteSpace(binding)
            || binding.Length > 128))
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-required-bindings",
                "Required binding names must be unique non-empty strings up to 128 characters.");
        }
        string[] bindings = authoredBindings
            .Select(binding => binding!.Trim())
            .Order(StringComparer.Ordinal)
            .ToArray();
        if (bindings.Distinct(StringComparer.Ordinal).Count() != bindings.Length)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-required-bindings",
                "Required binding names must be unique non-empty strings up to 128 characters.");
        }
        return new DefinitionReleaseContent
        {
            ManagedDefinitionName = revision.ManagedDefinitionName,
            VersionLabel = request.VersionLabel,
            ConformanceVersion = KajayContracts.SupportedConformanceVersions.Max(),
            Workflow = SingleSurveyWorkflow.Create(revision.DefinitionDigest),
            SurveyDefinitions = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                [revision.DefinitionDigest] = revision.DefinitionJson,
            },
            RequiredBindings = bindings,
        };
    }

    private static DefinitionRevisionResult ToRevisionResult(
        DefinitionRevisionRecord revision,
        bool created)
    {
        return new DefinitionRevisionResult(
            revision.ManagedDefinitionName,
            revision.Number,
            revision.SourceDraftVersion,
            JsonSerializer.Deserialize<JsonElement>(revision.DefinitionJson),
            revision.DefinitionDigest,
            revision.CreatedBy,
            revision.CreatedAt,
            created);
    }

    private void AppendAudit(
        string tenantId,
        string actorId,
        string managedDefinitionName,
        string eventType,
        long version,
        DateTimeOffset now)
    {
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            Subject = managedDefinitionName,
            EventType = eventType,
            PayloadJson = JsonSerializer.Serialize(new { version }),
            ActorId = actorId,
            OccurredAt = now,
        });
    }

    private void AppendReleaseAudit(
        string tenantId,
        string actorId,
        DefinitionRevisionRecord revision,
        ReleaseInstallResult release)
    {
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            Subject = release.Digest,
            EventType = "definition-release-created",
            PayloadJson = JsonSerializer.Serialize(new
            {
                managedDefinitionName = revision.ManagedDefinitionName,
                revisionNumber = revision.Number,
                versionLabel = release.VersionLabel,
            }),
            ActorId = actorId,
            OccurredAt = _timeProvider.GetUtcNow(),
        });
    }
}
