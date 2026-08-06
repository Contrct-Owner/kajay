namespace Kajay.Workflow.Host.Contracts;

internal sealed record ScheduledActionResult(
    string ActionId,
    string StepKey,
    string Status,
    int Attempts,
    DateTimeOffset DueAt,
    string? LastError,
    DateTimeOffset? CompletedAt);
