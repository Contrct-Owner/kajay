namespace Kajay.Cli.Promotion;

internal sealed record ReleaseInstallResponse(
    string Digest,
    string ManagedDefinitionName,
    string VersionLabel,
    bool Installed);
