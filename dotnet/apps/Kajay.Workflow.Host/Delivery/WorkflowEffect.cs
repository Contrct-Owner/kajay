using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Delivery;

public sealed record WorkflowEffect(
    string Id,
    string Type,
    JsonNode Payload,
    string TenantId,
    Guid WorkflowInstanceId);
