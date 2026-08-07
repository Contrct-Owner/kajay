namespace Kajay.Workflow.Host.Persistence;

internal sealed class DefinitionReleaseProvenanceRecord
{
    public required string TenantId { get; set; }

    public required string ReleaseDigest { get; set; }

    public required string ManagedDefinitionName { get; set; }

    public long RevisionNumber { get; set; }

    public required string LinkedBy { get; set; }

    public DateTimeOffset LinkedAt { get; set; }
}
