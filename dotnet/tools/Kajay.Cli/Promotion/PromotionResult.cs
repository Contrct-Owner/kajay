namespace Kajay.Cli.Promotion;

internal sealed record PromotionResult(
    string Digest,
    string ManagedDefinitionName,
    string VersionLabel,
    string EnvironmentName,
    bool Installed,
    long? ActivationVersion,
    string? ApprovedBy);
