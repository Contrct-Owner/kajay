namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReleaseHistoryPageQuery(
    string EnvironmentName,
    int? Limit,
    string? Cursor,
    string? Query,
    string? Status);
