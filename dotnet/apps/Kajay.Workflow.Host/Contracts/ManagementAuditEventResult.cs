using System.Text.Json;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record ManagementAuditEventResult(
    Guid Id,
    string Subject,
    string EventType,
    JsonElement Payload,
    string ActorId,
    DateTimeOffset OccurredAt);
