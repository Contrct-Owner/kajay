namespace Kajay.Workflow.Host.Persistence;

internal sealed class DefinitionRevisionRecord
{
    public required string TenantId { get; set; }

    public required string ManagedDefinitionName { get; set; }

    public long Number { get; set; }

    public long SourceDraftVersion { get; set; }

    public required string DefinitionJson { get; set; }

    public required string DefinitionDigest { get; set; }

    public required string CreatedBy { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
