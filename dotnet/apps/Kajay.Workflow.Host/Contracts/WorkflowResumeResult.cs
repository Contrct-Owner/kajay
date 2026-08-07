namespace Kajay.Workflow.Host.Contracts;

internal sealed record WorkflowResumeResult(
    string DispatchId,
    string Kind,
    string StepKey,
    string Status,
    int Attempts,
    DateTimeOffset AvailableAt,
    string? LastError,
    DateTimeOffset? CompletedAt);
