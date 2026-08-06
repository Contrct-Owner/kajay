namespace Kajay.Workflow.Host.Contracts;

internal sealed record EffectDeliveryResult(
    string EffectId,
    string EffectType,
    string Status,
    int Attempts,
    DateTimeOffset AvailableAt,
    string? LastError,
    DateTimeOffset? DeliveredAt);
