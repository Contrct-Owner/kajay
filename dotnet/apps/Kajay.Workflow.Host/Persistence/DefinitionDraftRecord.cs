namespace Kajay.Workflow.Host.Persistence;

internal sealed class DefinitionDraftRecord
{
    public required string TenantId { get; set; }

    public required string ManagedDefinitionName { get; set; }

    public required string DefinitionJson { get; set; }

    public required string DefinitionDigest { get; set; }

    public long Version { get; set; }

    public required string UpdatedBy { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
