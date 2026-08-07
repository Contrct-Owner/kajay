namespace Kajay.Workflow.Host.Persistence;

internal sealed class ReviewTaskRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public Guid WorkflowInstanceId { get; set; }

    public Guid SubmissionId { get; set; }

    public required string StepKey { get; set; }

    public int RoundNumber { get; set; }

    public required string AssignedPermission { get; set; }

    public required string Status { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string? DecidedBy { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }

    public string? Comment { get; set; }
}
