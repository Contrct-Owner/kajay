namespace Kajay.Cli.Promotion;

internal sealed record ActivationResponse(
    string EnvironmentName,
    string ManagedDefinitionName,
    string ReleaseDigest,
    long Version,
    string? ApprovedBy);
