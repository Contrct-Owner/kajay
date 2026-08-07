using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    internal async Task<CursorPageResult<DefinitionReleaseHistoryResult>> GetReleasesAsync(
        string tenantId,
        string managedDefinitionName,
        ReleaseHistoryPageQuery request,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        ValidateName(request.EnvironmentName, nameof(request.EnvironmentName));
        _ = await LoadDefinitionAsync(tenantId, managedDefinitionName, cancellationToken)
            .ConfigureAwait(false);
        _ = await LoadEnvironmentsAsync(
            tenantId, request.EnvironmentName, cancellationToken).ConfigureAwait(false);
        ActivationRecord? activation = await LoadActivationAsync(
            tenantId, managedDefinitionName, request.EnvironmentName, cancellationToken)
            .ConfigureAwait(false);
        string[] bindings = await LoadBindingsAsync(
            tenantId, request.EnvironmentName, cancellationToken).ConfigureAwait(false);
        return await LoadReleasePageAsync(
            tenantId, managedDefinitionName, request, bindings, activation,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<CursorPageResult<DefinitionReleaseHistoryResult>> LoadReleasePageAsync(
        string tenantId,
        string managedDefinitionName,
        ReleaseHistoryPageQuery request,
        IReadOnlyCollection<string> bindings,
        ActivationRecord? activation,
        CancellationToken cancellationToken)
    {
        int limit = ReadLimit(request.Limit);
        ReleasePageCursor? cursor = ReadCursor(request.Cursor, ProvenanceCursor.ReadRelease);
        string? query = ReadFilter(request.Query, "Release query");
        string? status = ReadStatus(request.Status);
        var matches = new List<ReleaseFact>(limit + 1);
        ReleasePageCursor? scan = cursor;
        while (matches.Count <= limit)
        {
            ReleaseFact[] batch = await LoadReleaseBatchAsync(
                tenantId, managedDefinitionName, scan, query, cancellationToken)
                .ConfigureAwait(false);
            foreach (ReleaseFact release in batch.Where(
                item => MatchesStatus(item, status, bindings, activation)))
            {
                matches.Add(release);
                if (matches.Count > limit)
                {
                    break;
                }
            }
            if (batch.Length < MaximumPageSize || matches.Count > limit)
            {
                break;
            }
            ReleaseFact last = batch[^1];
            scan = new ReleasePageCursor(last.InstalledAt, last.Digest);
        }
        ReleaseFact[] page = matches.Take(limit).ToArray();
        DefinitionReleaseProvenanceRecord[] links = await LoadReleaseLinksAsync(
            tenantId, managedDefinitionName, page, cancellationToken).ConfigureAwait(false);
        ActivationAuditFact[] history = await LoadActivationHistoryAsync(
            tenantId, managedDefinitionName, request.EnvironmentName,
            page.Select(item => item.Digest).ToArray(), cancellationToken).ConfigureAwait(false);
        string? next = matches.Count > limit
            ? ProvenanceCursor.ForRelease(page[^1].InstalledAt, page[^1].Digest)
            : null;
        return new CursorPageResult<DefinitionReleaseHistoryResult>(
            ToReleaseResults(page, links, bindings, activation, history), next);
    }

    private async Task<ReleaseFact[]> LoadReleaseBatchAsync(
        string tenantId,
        string managedDefinitionName,
        ReleasePageCursor? cursor,
        string? filter,
        CancellationToken cancellationToken)
    {
        IQueryable<DefinitionReleaseRecord> query = _database.DefinitionReleases.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName);
        if (cursor is not null)
        {
            query = query.Where(item => item.InstalledAt < cursor.Value.InstalledAt
                || (item.InstalledAt == cursor.Value.InstalledAt
                    && item.Digest.CompareTo(cursor.Value.Digest) < 0));
        }
        if (filter is not null)
        {
            string pattern = ToSearchPattern(filter);
            query = query.Where(item => EF.Functions.ILike(item.VersionLabel, pattern, "\\")
                || EF.Functions.ILike(item.Digest, pattern, "\\"));
        }
        return await query.OrderByDescending(item => item.InstalledAt)
            .ThenByDescending(item => item.Digest)
            .Take(MaximumPageSize)
            .Select(item => new ReleaseFact(
                item.Digest, item.VersionLabel, item.ConformanceVersion,
                item.RequiredBindings, item.InstalledAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<DefinitionReleaseProvenanceRecord[]> LoadReleaseLinksAsync(
        string tenantId,
        string managedDefinitionName,
        IReadOnlyCollection<ReleaseFact> releases,
        CancellationToken cancellationToken)
    {
        string[] digests = releases.Select(item => item.Digest).ToArray();
        return digests.Length == 0
            ? []
            : await _database.DefinitionReleaseProvenance.AsNoTracking()
                .Where(item => item.TenantId == tenantId
                    && item.ManagedDefinitionName == managedDefinitionName
                    && digests.Contains(item.ReleaseDigest))
                .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    private static string? ReadStatus(string? value)
    {
        string? status = ReadFilter(value, "Release status")?.ToLowerInvariant();
        return status is null or "active" or "ready" or "blocked"
            ? status
            : throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-release-status",
                "Release status must be active, ready, or blocked.");
    }

    private static bool MatchesStatus(
        ReleaseFact release,
        string? status,
        IReadOnlyCollection<string> bindings,
        ActivationRecord? activation)
    {
        if (status is null)
        {
            return true;
        }
        bool active = release.Digest == activation?.ReleaseDigest;
        bool blocked = release.RequiredBindings.Except(bindings, StringComparer.Ordinal).Any();
        return status == "active" ? active : status == "blocked" ? !active && blocked : !active && !blocked;
    }
}
