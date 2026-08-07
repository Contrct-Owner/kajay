using System.Text.Json;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    private static DefinitionActivationStateResult ToActivationResult(
        ActivationRecord? activation,
        string? versionLabel,
        IReadOnlyList<ActivationAuditFact> history)
    {
        if (activation is null)
        {
            return new DefinitionActivationStateResult(0, null, null, null, null, null);
        }
        string? actor = history.FirstOrDefault(item => item.Version == activation.Version
            && item.ReleaseDigest == activation.ReleaseDigest)?.ActorId;
        return new DefinitionActivationStateResult(
            activation.Version,
            activation.ReleaseDigest,
            versionLabel,
            actor,
            activation.ApprovedBy,
            activation.ActivatedAt);
    }

    private static DefinitionRevisionHistoryResult[] ToRevisionResults(
        IReadOnlyList<RevisionFact> revisions,
        IReadOnlyList<DefinitionReleaseProvenanceRecord> links) =>
        revisions.Select(revision => new DefinitionRevisionHistoryResult(
            revision.Number,
            revision.SourceDraftVersion,
            revision.DefinitionDigest,
            revision.CreatedBy,
            revision.CreatedAt,
            links.Where(link => link.RevisionNumber == revision.Number)
                .Select(link => link.ReleaseDigest)
                .Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray()))
            .ToArray();

    private static DefinitionReleaseHistoryResult[] ToReleaseResults(
        IReadOnlyList<ReleaseFact> releases,
        IReadOnlyList<DefinitionReleaseProvenanceRecord> links,
        IReadOnlyCollection<string> bindings,
        ActivationRecord? activation,
        IReadOnlyList<ActivationAuditFact> history)
    {
        var presentBindings = new HashSet<string>(bindings, StringComparer.Ordinal);
        var activatedDigests = new HashSet<string>(
            history.Select(item => item.ReleaseDigest), StringComparer.Ordinal);
        return releases.Select(release =>
        {
            string[] missing = release.RequiredBindings
                .Where(item => !presentBindings.Contains(item))
                .Order(StringComparer.Ordinal).ToArray();
            bool active = release.Digest == activation?.ReleaseDigest;
            string status = active ? "active" : missing.Length == 0 ? "ready" : "blocked";
            bool canActivate = !active && missing.Length == 0;
            bool canRollback = activation is not null
                && canActivate
                && activatedDigests.Contains(release.Digest);
            return new DefinitionReleaseHistoryResult(
                release.Digest,
                release.VersionLabel,
                release.ConformanceVersion,
                release.InstalledAt,
                links.Where(link => link.ReleaseDigest == release.Digest)
                    .Select(link => link.RevisionNumber).Distinct()
                    .Order().ToArray(),
                release.RequiredBindings.Order(StringComparer.Ordinal).ToArray(),
                missing,
                status,
                canActivate,
                canRollback);
        }).ToArray();
    }

    private static ManagementAuditEventResult ToAuditResult(ManagementAuditEventRecord item) =>
        new(
            item.Id,
            item.Subject,
            item.EventType,
            ReadPayload(item.PayloadJson),
            item.ActorId,
            item.OccurredAt);

    private static JsonElement ReadPayload(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<JsonElement>(json);
        }
        catch (JsonException)
        {
            return JsonSerializer.SerializeToElement(new { raw = json });
        }
    }
}
