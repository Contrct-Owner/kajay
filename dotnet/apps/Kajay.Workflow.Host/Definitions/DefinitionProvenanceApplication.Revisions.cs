using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    internal async Task<CursorPageResult<DefinitionRevisionHistoryResult>> GetRevisionsAsync(
        string tenantId,
        string managedDefinitionName,
        RevisionHistoryPageQuery request,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        _ = await LoadDefinitionAsync(tenantId, managedDefinitionName, cancellationToken)
            .ConfigureAwait(false);
        return await LoadRevisionPageAsync(
            tenantId, managedDefinitionName, request, cancellationToken).ConfigureAwait(false);
    }

    private async Task<CursorPageResult<DefinitionRevisionHistoryResult>> LoadRevisionPageAsync(
        string tenantId,
        string managedDefinitionName,
        RevisionHistoryPageQuery request,
        CancellationToken cancellationToken)
    {
        int limit = ReadLimit(request.Limit);
        long? cursor = ReadRevisionCursor(request.Cursor);
        string? filter = ReadFilter(request.Query, "Revision query");
        IQueryable<DefinitionRevisionRecord> query = _database.DefinitionRevisions.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName);
        if (cursor is not null)
        {
            query = query.Where(item => item.Number < cursor.Value);
        }
        if (filter is not null)
        {
            string pattern = ToSearchPattern(filter);
            query = query.Where(item => EF.Functions.ILike(item.CreatedBy, pattern, "\\")
                || EF.Functions.ILike(item.DefinitionDigest, pattern, "\\"));
        }
        RevisionFact[] facts = await query.OrderByDescending(item => item.Number)
            .Take(limit + 1)
            .Select(item => new RevisionFact(
                item.Number, item.SourceDraftVersion, item.DefinitionDigest,
                item.CreatedBy, item.CreatedAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        RevisionFact[] page = facts.Take(limit).ToArray();
        DefinitionReleaseProvenanceRecord[] links = await LoadRevisionLinksAsync(
            tenantId, managedDefinitionName, page, cancellationToken).ConfigureAwait(false);
        string? next = facts.Length > limit
            ? ProvenanceCursor.ForRevision(page[^1].Number)
            : null;
        return new CursorPageResult<DefinitionRevisionHistoryResult>(
            ToRevisionResults(page, links), next);
    }

    private async Task<DefinitionReleaseProvenanceRecord[]> LoadRevisionLinksAsync(
        string tenantId,
        string managedDefinitionName,
        IReadOnlyCollection<RevisionFact> revisions,
        CancellationToken cancellationToken)
    {
        long[] numbers = revisions.Select(item => item.Number).ToArray();
        return numbers.Length == 0
            ? []
            : await _database.DefinitionReleaseProvenance.AsNoTracking()
                .Where(item => item.TenantId == tenantId
                    && item.ManagedDefinitionName == managedDefinitionName
                    && numbers.Contains(item.RevisionNumber))
                .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }
}
