using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record WorkflowInstanceResult(
    Guid Id,
    string EnvironmentName,
    string ManagedDefinitionName,
    string ReleaseDigest,
    string Status,
    string ActiveStepKey,
    JsonNode? ResponseSnapshot,
    long Version)
{
    internal static WorkflowInstanceResult From(WorkflowInstanceRecord instance)
    {
        return new WorkflowInstanceResult(
            instance.Id,
            instance.EnvironmentName,
            instance.ManagedDefinitionName,
            instance.ReleaseDigest,
            instance.Status,
            instance.ActiveStepKey,
            instance.ResponseSnapshotJson is null
                ? null
                : JsonNode.Parse(instance.ResponseSnapshotJson),
            instance.Version);
    }
}
