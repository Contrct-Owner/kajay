namespace Kajay.Workflow.Host.Contracts;

internal sealed record WorkflowWorkResult(
    IReadOnlyList<EffectDeliveryResult> Effects,
    IReadOnlyList<ScheduledActionResult> ScheduledActions,
    IReadOnlyList<WorkflowResumeResult> Resumes);
