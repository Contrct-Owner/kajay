namespace Kajay.Workflow.Host.Authentication;

internal sealed record AuthenticatedActor(string Id, IReadOnlySet<string> Permissions)
{
    internal bool HasPermission(string permission) => Permissions.Contains(permission);
}
