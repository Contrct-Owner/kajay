using System.Text.Json;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowAudit(WorkflowDbContext database)
{
    internal void Append(
        WorkflowInstanceRecord instance,
        string eventType,
        object payload,
        string actorId,
        DateTimeOffset occurredAt)
    {
        long sequence = instance.NextAuditSequence;
        instance.NextAuditSequence += 1;
        database.WorkflowAuditEvents.Add(new WorkflowAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = instance.TenantId,
            WorkflowInstanceId = instance.Id,
            Sequence = sequence,
            EventType = eventType,
            PayloadJson = JsonSerializer.Serialize(payload, WorkflowJson.Options),
            ActorId = actorId,
            OccurredAt = occurredAt,
        });
    }
}
