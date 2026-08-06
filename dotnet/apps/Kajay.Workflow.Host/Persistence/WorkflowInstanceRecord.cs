namespace Kajay.Workflow.Host.Persistence;

internal sealed class WorkflowInstanceRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public required string EnvironmentName { get; set; }

    public required string ManagedDefinitionName { get; set; }

    public required string ReleaseDigest { get; set; }

    public required string Status { get; set; }

    public required string ActiveStepKey { get; set; }

    public string? ResponseSnapshotJson { get; set; }

    public long Version { get; set; }

    public long NextAuditSequence { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }
}
