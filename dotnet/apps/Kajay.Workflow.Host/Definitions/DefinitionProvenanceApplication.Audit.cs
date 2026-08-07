using System.Text.Json;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    private async Task<ManagementAuditEventRecord[]> LoadAuditAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
        IReadOnlyList<ReleaseFact> releases,
        CancellationToken cancellationToken)
    {
        string[] subjects = releases.Select(item => item.Digest)
            .Append(managedDefinitionName)
            .Append($"{environmentName}/{managedDefinitionName}")
            .Concat(releases.SelectMany(item => item.RequiredBindings)
                .Select(name => $"{environmentName}/{name}"))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        return await _database.ManagementAuditEvents.AsNoTracking()
            .Where(item => item.TenantId == tenantId && subjects.Contains(item.Subject))
            .OrderByDescending(item => item.OccurredAt)
            .ThenByDescending(item => item.Id)
            .Take(100)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<ManagementAuditEventRecord[]> LoadActivationAuditAsync(
        string tenantId,
        string managedDefinitionName,
        string environmentName,
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
