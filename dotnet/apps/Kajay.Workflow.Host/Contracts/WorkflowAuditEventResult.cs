using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record WorkflowAuditEventResult(
    long Sequence,
    string EventType,
    JsonNode Payload,
    string ActorId,
    DateTimeOffset OccurredAt)
{
    internal static WorkflowAuditEventResult From(WorkflowAuditEventRecord record)
    {
        return new WorkflowAuditEventResult(
            record.Sequence,
            record.EventType,
            JsonNode.Parse(record.PayloadJson)!,
            record.ActorId,
            record.OccurredAt);
    }
}
