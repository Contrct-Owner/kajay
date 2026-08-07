namespace Kajay.Workflow.Host.Persistence;

internal sealed class SurveySubmissionRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public Guid WorkflowInstanceId { get; set; }

    public required string StepKey { get; set; }

    public int AttemptNumber { get; set; }

    public required string DefinitionDigest { get; set; }

    public required string SnapshotJson { get; set; }

    public required string SubmittedBy { get; set; }

    public DateTimeOffset SubmittedAt { get; set; }
}
