namespace Kajay.Workflow.Host.Persistence;

internal sealed class ManagementAuditEventRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public required string Subject { get; set; }

    public required string EventType { get; set; }

    public required string PayloadJson { get; set; }

    public required string ActorId { get; set; }

    public DateTimeOffset OccurredAt { get; set; }
}
