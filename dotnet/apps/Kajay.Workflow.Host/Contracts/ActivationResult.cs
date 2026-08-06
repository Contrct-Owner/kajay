namespace Kajay.Workflow.Host.Contracts;

internal sealed record ActivationResult(
    string EnvironmentName,
    string ManagedDefinitionName,
    string ReleaseDigest,
    long Version,
    string? ApprovedBy);
