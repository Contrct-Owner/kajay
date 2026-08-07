namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionActivationStateResult(
    long Version,
    string? ReleaseDigest,
    string? VersionLabel,
    string? ActivatedBy,
    string? ApprovedBy,
    DateTimeOffset? ActivatedAt);
