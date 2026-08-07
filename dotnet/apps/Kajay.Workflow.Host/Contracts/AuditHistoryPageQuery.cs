namespace Kajay.Workflow.Host.Contracts;

internal sealed record AuditHistoryPageQuery(
    string EnvironmentName,
    int? Limit,
    string? Cursor,
    string? Query);
