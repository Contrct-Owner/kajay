namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReleaseInstallResult(
    string Digest,
    string ManagedDefinitionName,
    string VersionLabel,
    bool Installed);
