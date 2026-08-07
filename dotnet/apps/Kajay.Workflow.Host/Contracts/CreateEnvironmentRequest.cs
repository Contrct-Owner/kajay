namespace Kajay.Workflow.Host.Contracts;

internal sealed record CreateEnvironmentRequest(
    string Name,
    string DisplayName,
    bool RequiresApproval,
    int Position);
