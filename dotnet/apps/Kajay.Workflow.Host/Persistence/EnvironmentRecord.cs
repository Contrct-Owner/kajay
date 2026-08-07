namespace Kajay.Workflow.Host.Persistence;

internal sealed class EnvironmentRecord
{
    public required string TenantId { get; set; }

    public required string Name { get; set; }

    public required string DisplayName { get; set; }

    public bool RequiresApproval { get; set; }

    public int Position { get; set; }

    public long Version { get; set; }

    public required string CreatedBy { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public required string UpdatedBy { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
