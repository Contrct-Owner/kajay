using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Delivery;

internal sealed record OutboxLease(
    Guid MessageId,
    Guid LeaseToken,
    int Attempt,
    WorkflowEffect Effect)
{
    internal static OutboxLease From(OutboxMessageRecord record)
    {
        return new OutboxLease(
            record.Id,
            record.LeaseToken!.Value,
            record.Attempts,
            new WorkflowEffect(
                record.EffectId,
                record.EffectType,
                JsonNode.Parse(record.PayloadJson)!,
                record.TenantId,
                record.WorkflowInstanceId));
    }
}
