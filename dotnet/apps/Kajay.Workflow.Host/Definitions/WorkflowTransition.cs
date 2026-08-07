namespace Kajay.Workflow.Host.Definitions;

internal sealed record WorkflowTransition(string TargetStepKey, string? Outcome);
