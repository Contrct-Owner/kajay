namespace Kajay.Workflow.Host.Authentication;

internal sealed record WorkOSSessionResult(
    string Subject,
    string OrganizationId,
    IReadOnlyCollection<string> Permissions);
