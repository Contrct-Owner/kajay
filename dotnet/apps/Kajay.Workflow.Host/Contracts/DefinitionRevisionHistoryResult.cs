namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionRevisionHistoryResult(
    long Number,
    long SourceDraftVersion,
    string DefinitionDigest,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    IReadOnlyList<string> ReleaseDigests);
