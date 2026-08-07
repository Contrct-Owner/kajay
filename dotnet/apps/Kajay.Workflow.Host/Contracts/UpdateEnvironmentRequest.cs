namespace Kajay.Workflow.Host.Contracts;

internal sealed record UpdateEnvironmentRequest(
    string DisplayName,
    bool RequiresApproval,
    int Position);
