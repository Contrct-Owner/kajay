namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReleasePreflightResult(
    string Digest,
    string ManagedDefinitionName,
    string VersionLabel,
    bool Compatible,
    IReadOnlyList<string> MissingBindings);
