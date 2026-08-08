using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Workflows;

internal static class ReviewTaskAuthorization
{
    internal static void EnsureAssigned(AuthenticatedActor actor, ReviewTaskRecord task)
    {
        if (!actor.HasPermission(task.AssignedPermission))
        {
            throw new WorkflowProblemException(
                StatusCodes.Status403Forbidden,
                "review-task-not-assigned",
                "The authenticated principal is not assigned to this Review Task.");
        }
    }
}
