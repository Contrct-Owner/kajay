namespace Kajay.Workflow.Host.Persistence;

internal sealed class ManagedDefinitionRecord
{
    public required string TenantId { get; set; }

    public required string Name { get; set; }

    public required string CreatedBy { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
