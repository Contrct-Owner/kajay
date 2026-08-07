namespace Kajay.Cli.Promotion;

internal sealed record ReleasePreflightResponse(
    string Digest,
    string ManagedDefinitionName,
    string VersionLabel,
    bool Compatible,
    IReadOnlyList<string> MissingBindings);
