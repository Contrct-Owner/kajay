namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReviewTaskQueueItemResult(
    ReviewTaskResult Task,
    string EnvironmentName,
    string ManagedDefinitionName,
    string ReleaseDigest,
    string WorkflowStatus,
    string ActiveStepKey,
    long WorkflowVersion);
