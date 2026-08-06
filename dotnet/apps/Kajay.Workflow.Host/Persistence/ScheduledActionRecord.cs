namespace Kajay.Workflow.Host.Persistence;

internal sealed class ScheduledActionRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public Guid WorkflowInstanceId { get; set; }

    public required string ActionId { get; set; }

    public required string StepKey { get; set; }

    public required string Status { get; set; }

    public DateTimeOffset DueAt { get; set; }

    public int Attempts { get; set; }

    public Guid? LeaseToken { get; set; }

    public DateTimeOffset? LeaseUntil { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }
}
