namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReviewTaskPageQuery(
    string? Status,
    string? ManagedDefinitionName,
    DateTimeOffset? CreatedAfter,
    DateTimeOffset? CreatedBefore,
    int? Limit,
    string? Cursor);
