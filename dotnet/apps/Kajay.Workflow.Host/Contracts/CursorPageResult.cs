namespace Kajay.Workflow.Host.Contracts;

internal sealed record CursorPageResult<T>(
    IReadOnlyList<T> Items,
    string? NextCursor);
