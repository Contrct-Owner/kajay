namespace Kajay.Workflow.Host.Persistence;

internal sealed class OutboxMessageRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public Guid WorkflowInstanceId { get; set; }

    public required string EffectId { get; set; }

    public required string EffectType { get; set; }

    public required string PayloadJson { get; set; }

    public required string Status { get; set; }

    public int Attempts { get; set; }

    public DateTimeOffset AvailableAt { get; set; }

    public Guid? LeaseToken { get; set; }

    public DateTimeOffset? LeaseUntil { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? DeliveredAt { get; set; }
}
