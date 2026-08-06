namespace Kajay.Workflow.Host.Persistence;

internal sealed class WorkflowAuditEventRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public Guid WorkflowInstanceId { get; set; }

    public long Sequence { get; set; }

    public required string EventType { get; set; }

    public required string PayloadJson { get; set; }

    public required string ActorId { get; set; }

    public DateTimeOffset OccurredAt { get; set; }
}
