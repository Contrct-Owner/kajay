using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReviewTaskResult(
    Guid Id,
    Guid WorkflowInstanceId,
    Guid SubmissionId,
    string StepKey,
    int RoundNumber,
    string AssignedPermission,
    string Status,
    DateTimeOffset CreatedAt,
    string? DecidedBy,
    DateTimeOffset? DecidedAt,
    string? Comment)
{
    internal static ReviewTaskResult From(ReviewTaskRecord task)
    {
        return new ReviewTaskResult(
            task.Id,
            task.WorkflowInstanceId,
            task.SubmissionId,
            task.StepKey,
            task.RoundNumber,
            task.AssignedPermission,
            task.Status,
            task.CreatedAt,
            task.DecidedBy,
            task.DecidedAt,
            task.Comment);
    }
}
