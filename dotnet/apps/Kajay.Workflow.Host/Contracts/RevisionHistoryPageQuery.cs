namespace Kajay.Workflow.Host.Contracts;

internal sealed record RevisionHistoryPageQuery(
    int? Limit,
    string? Cursor,
    string? Query);
