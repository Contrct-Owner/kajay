using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Delivery;

internal sealed record WorkflowResumeLease(
    Guid RecordId,
    Guid LeaseToken,
    string TenantId,
    Guid WorkflowInstanceId,
    string Kind,
    string StepKey,
    Guid? SubmissionId)
{
    internal static WorkflowResumeLease From(WorkflowResumeRecord record)
    {
        return new WorkflowResumeLease(
            record.Id,
            record.LeaseToken!.Value,
            record.TenantId,
            record.WorkflowInstanceId,
            record.Kind,
            record.StepKey,
            record.SubmissionId);
    }
}
