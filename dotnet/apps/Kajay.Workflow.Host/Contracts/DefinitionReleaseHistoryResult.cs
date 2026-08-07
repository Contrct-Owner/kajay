namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionReleaseHistoryResult(
    string Digest,
    string VersionLabel,
    int ConformanceVersion,
    DateTimeOffset InstalledAt,
    IReadOnlyList<long> SourceRevisionNumbers,
    IReadOnlyList<string> RequiredBindings,
    IReadOnlyList<string> MissingBindings,
    string PromotionStatus,
    bool CanRollback);
