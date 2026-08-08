using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReviewWorkflowInstanceResult(
    Guid Id,
    string EnvironmentName,
    string ManagedDefinitionName,
    string ReleaseDigest,
    string Status,
    string ActiveStepKey,
    long Version)
{
    internal static ReviewWorkflowInstanceResult From(WorkflowInstanceRecord instance) => new(
        instance.Id,
        instance.EnvironmentName,
        instance.ManagedDefinitionName,
        instance.ReleaseDigest,
        instance.Status,
        instance.ActiveStepKey,
        instance.Version);
}
