using Microsoft.AspNetCore.Authorization;

namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSPermissionHandler
    : AuthorizationHandler<WorkOSPermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        WorkOSPermissionRequirement requirement)
    {
        if (WorkOSClaimValues.HasPermission(context.User, requirement.Permission))
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
