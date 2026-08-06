using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Delivery;

internal sealed record ScheduledActionLease(
    Guid ActionRecordId,
    Guid LeaseToken,
    int Attempt,
    string ActionId,
    string TenantId,
    Guid WorkflowInstanceId,
    string StepKey)
{
    internal static ScheduledActionLease From(ScheduledActionRecord record)
    {
        return new ScheduledActionLease(
            record.Id,
            record.LeaseToken!.Value,
            record.Attempts,
            record.ActionId,
            record.TenantId,
            record.WorkflowInstanceId,
            record.StepKey);
    }
}
