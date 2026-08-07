namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    private sealed record RevisionFact(
        long Number,
        long SourceDraftVersion,
        string DefinitionDigest,
        string CreatedBy,
        DateTimeOffset CreatedAt);

    private sealed record ReleaseFact(
        string Digest,
        string VersionLabel,
        int ConformanceVersion,
        string[] RequiredBindings,
        DateTimeOffset InstalledAt);
}
