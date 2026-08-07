using System.Text.Json;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    internal async Task<CursorPageResult<ManagementAuditEventResult>> GetAuditAsync(
        string tenantId,
        string managedDefinitionName,
        AuditHistoryPageQuery request,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        ValidateName(request.EnvironmentName, nameof(request.EnvironmentName));
        _ = await LoadDefinitionAsync(tenantId, managedDefinitionName, cancellationToken)
            .ConfigureAwait(false);
        _ = await LoadEnvironmentsAsync(
            tenantId, request.EnvironmentName, cancellationToken).ConfigureAwait(false);
        return await LoadAuditPageAsync(
            tenantId, managedDefinitionName, request, cancellationToken).ConfigureAwait(false);
    }

    private async Task<CursorPageResult<ManagementAuditEventResult>> LoadAuditPageAsync(
        string tenantId,
        string managedDefinitionName,
        AuditHistoryPageQuery request,
        CancellationToken cancellationToken)
    {
        int limit = ReadLimit(request.Limit);
        AuditPageCursor? cursor = ReadCursor(request.Cursor, ProvenanceCursor.ReadAudit);
        string? filter = ReadFilter(request.Query, "Audit query");
        IQueryable<ManagementAuditEventRecord> query = RelevantAuditQuery(
            tenantId, managedDefinitionName, request.EnvironmentName);
        if (cursor is not null)
        {
            query = query.Where(item => item.OccurredAt < cursor.Value.OccurredAt
                || (item.OccurredAt == cursor.Value.OccurredAt
                    && item.Id.CompareTo(cursor.Value.Id) < 0));
        }
        if (filter is not null)
        {
            string pattern = ToSearchPattern(filter);
            query = query.Where(item => EF.Functions.ILike(item.EventType, pattern, "\\")
                || EF.Functions.ILike(item.ActorId, pattern, "\\")
                || EF.Functions.ILike(item.Subject, pattern, "\\"));
        }
        ManagementAuditEventRecord[] facts = await query
            .OrderByDescending(item => item.OccurredAt)
            .ThenByDescending(item => item.Id)
            .Take(limit + 1)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        ManagementAuditEventRecord[] page = facts.Take(limit).ToArray();
        string? next = facts.Length > limit
            ? ProvenanceCursor.ForAudit(page[^1].OccurredAt, page[^1].Id)
            : null;
        return new CursorPageResult<ManagementAuditEventResult>(
            page.Select(ToAuditResult).ToArray(), next);
    }

    private IQueryable<ManagementAuditEventRecord> RelevantAuditQuery(
        string tenantId,
        string managedDefinitionName,
        string environmentName)
    {
        string activationSubject = $"{environmentName}/{managedDefinitionName}";
        string bindingPrefix = $"{environmentName}/";
        IQueryable<string> digests = _database.DefinitionReleases
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName)
            .Select(item => item.Digest);
        return _database.ManagementAuditEvents.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && (item.Subject == managedDefinitionName
                    || item.Subject == activationSubject
                    || digests.Contains(item.Subject)
                    || (item.EventType.StartsWith("environment-binding-")
                        && item.Subject.StartsWith(bindingPrefix))));
    }

    private async Task<ActivationAuditFact[]> LoadActivationHistoryAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
        string[] releaseDigests,
        CancellationToken cancellationToken)
    {
        if (releaseDigests.Length == 0)
        {
            return [];
        }
        ManagementAuditEventRecord[] audit = await LoadActivationAuditAsync(
            tenantId, managedDefinitionName, environmentName, releaseDigests, cancellationToken)
            .ConfigureAwait(false);
        return ReadActivationHistory(audit, environmentName, managedDefinitionName);
    }

    private async Task<ManagementAuditEventRecord[]> LoadActivationAuditAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
        string[] releaseDigests,
        CancellationToken cancellationToken)
    {
        string subject = $"{environmentName}/{managedDefinitionName}";
        return await _database.ManagementAuditEvents.FromSqlInterpolated($$"""
                SELECT DISTINCT ON (COALESCE(
                    "PayloadJson" ->> 'releaseDigest', "PayloadJson" ->> 'ReleaseDigest')) *
                FROM "management_audit_events"
                WHERE "TenantId" = {{tenantId}}
                    AND "Subject" = {{subject}}
                    AND "EventType" = 'definition-release-activated'
                    AND COALESCE("PayloadJson" ->> 'releaseDigest',
                        "PayloadJson" ->> 'ReleaseDigest') = ANY({{releaseDigests}})
                ORDER BY COALESCE(
                    "PayloadJson" ->> 'releaseDigest', "PayloadJson" ->> 'ReleaseDigest'),
                    "OccurredAt" DESC,
                    "Id" DESC
                """)
            .AsNoTracking()
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    private static ActivationAuditFact[] ReadActivationHistory(
        IReadOnlyList<ManagementAuditEventRecord> audit,
        string environmentName,
        string managedDefinitionName)
    {
        string subject = $"{environmentName}/{managedDefinitionName}";
        return audit.Where(item => item.Subject == subject
                && item.EventType == "definition-release-activated")
            .Select(TryReadActivation)
            .OfType<ActivationAuditFact>()
            .ToArray();
    }

    private static ActivationAuditFact? TryReadActivation(ManagementAuditEventRecord item)
    {
        try
        {
            using JsonDocument document = JsonDocument.Parse(item.PayloadJson);
            JsonElement root = document.RootElement;
            return TryGetProperty(root, "releaseDigest", "ReleaseDigest", out JsonElement digest)
                && digest.ValueKind == JsonValueKind.String
                && TryGetProperty(root, "version", "Version", out JsonElement version)
                && version.TryGetInt64(out long number)
                ? new ActivationAuditFact(digest.GetString()!, number, item.ActorId)
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool TryGetProperty(
        JsonElement root,
        string canonicalName,
        string legacyName,
        out JsonElement value) =>
        root.TryGetProperty(canonicalName, out value)
            || root.TryGetProperty(legacyName, out value);

    private sealed record ActivationAuditFact(string ReleaseDigest, long Version, string ActorId);
}
