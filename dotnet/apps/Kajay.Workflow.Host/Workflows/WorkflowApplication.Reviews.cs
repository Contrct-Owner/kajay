using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Workflows;

internal sealed partial class WorkflowApplication
{
    internal async Task<WorkflowInstanceResult> DecideReviewAsync(
        string tenantId,
        AuthenticatedActor actor,
        Guid instanceId,
        Guid reviewTaskId,
        long expectedVersion,
        string idempotencyKey,
        ReviewDecisionRequest request,
        CancellationToken cancellationToken)
    {
        const string operation = "decide-review-task";
        string outcome = ValidateDecision(request.Decision);
        string? comment = ValidateComment(request.Comment);
        ReviewTaskRecord authorizationTask = await LoadReviewTaskAsync(
            tenantId, instanceId, reviewTaskId, tracked: false, cancellationToken)
            .ConfigureAwait(false);
        EnsureAssigned(actor, authorizationTask);
        string requestHash = WorkflowCommandIdentity.Compute(
            operation,
            instanceId.ToString("N"),
            reviewTaskId.ToString("N"),
            expectedVersion.ToString(System.Globalization.CultureInfo.InvariantCulture),
            outcome,
            comment ?? string.Empty);
        await using IDbContextTransaction transaction = await idempotency.BeginAsync(
            tenantId, idempotencyKey, cancellationToken).ConfigureAwait(false);
        WorkflowInstanceResult? repeated = await FindRepeatedAsync(
            tenantId, idempotencyKey, operation, requestHash, cancellationToken)
            .ConfigureAwait(false);
        if (repeated is not null)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return await EnsureReviewResumedAsync(
                tenantId, idempotencyKey, repeated, resumeId: null, cancellationToken)
                .ConfigureAwait(false);
        }

        WorkflowInstanceRecord instance = await LoadInstanceAsync(
            tenantId, instanceId, tracked: true, cancellationToken).ConfigureAwait(false);
        EnsureVersion(instance, expectedVersion);
        ReviewTaskRecord task = await LoadReviewTaskAsync(
            tenantId, instanceId, reviewTaskId, tracked: true, cancellationToken)
            .ConfigureAwait(false);
        EnsurePending(instance, task);
        EnsureAssigned(actor, task);
        DateTimeOffset now = timeProvider.GetUtcNow();
        task.Status = outcome;
        task.Comment = comment;
        task.DecidedBy = actor.Id;
        task.DecidedAt = now;
        var resume = new WorkflowResumeRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            WorkflowInstanceId = instanceId,
            DispatchId = $"review:{task.Id:N}",
            Kind = "review",
            StepKey = task.StepKey,
            ReviewTaskId = task.Id,
            Status = "pending",
            AvailableAt = now,
            CreatedAt = now,
        };
        database.WorkflowResumes.Add(resume);
        instance.Status = "review-decided";
        Touch(instance);
        audit.Append(instance, "review-decision-recorded", new
        {
            reviewTaskId = task.Id,
            submissionId = task.SubmissionId,
            stepKey = task.StepKey,
            decision = outcome,
            comment,
        }, actor.Id, now);
        WorkflowInstanceResult result = WorkflowInstanceResult.From(instance);
        idempotency.Add(tenantId, idempotencyKey, operation, requestHash, result);
        await CommitAsync(expectedVersion, cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return await EnsureReviewResumedAsync(
            tenantId, idempotencyKey, result, resume.Id, cancellationToken).ConfigureAwait(false);
    }

    private async Task<ReviewTaskRecord> LoadReviewTaskAsync(
        string tenantId,
        Guid instanceId,
        Guid reviewTaskId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        IQueryable<ReviewTaskRecord> query = database.ReviewTasks;
        if (!tracked)
        {
            query = query.AsNoTracking();
        }
        return await query.SingleOrDefaultAsync(
            item => item.TenantId == tenantId
                && item.WorkflowInstanceId == instanceId
                && item.Id == reviewTaskId,
            cancellationToken).ConfigureAwait(false)
            ?? throw new WorkflowProblemException(
                StatusCodes.Status404NotFound,
                "review-task-not-found",
                $"Review Task '{reviewTaskId}' does not exist.");
    }

    private static void EnsurePending(
        WorkflowInstanceRecord instance,
        ReviewTaskRecord task)
    {
        if (task.Status != "pending"
            || instance.Status != "waiting-review"
            || !string.Equals(instance.ActiveStepKey, task.StepKey, StringComparison.Ordinal))
        {
            throw new WorkflowProblemException(
                StatusCodes.Status409Conflict,
                "review-task-not-pending",
                "The Review Task is no longer pending for the active workflow step.");
        }
    }

    private static void EnsureAssigned(AuthenticatedActor actor, ReviewTaskRecord task)
    {
        if (!actor.HasPermission(task.AssignedPermission))
        {
            throw new WorkflowProblemException(
                StatusCodes.Status403Forbidden,
                "review-task-not-assigned",
                "The authenticated principal is not assigned to this Review Task.");
        }
    }

    private static string ValidateDecision(string decision)
    {
        return decision switch
        {
            ReviewDecisions.Approve => ReviewDecisions.Approved,
            ReviewDecisions.Deny => ReviewDecisions.Denied,
            ReviewDecisions.RequestChanges => ReviewDecisions.ChangesRequested,
            _ => throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-review-decision",
                "Decision must be approve, deny, or request-changes."),
        };
    }

    private static string? ValidateComment(string? comment)
    {
        string? value = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        if (value?.Length > 2000)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "review-comment-too-long",
                "A review comment cannot exceed 2000 characters.");
        }
        return value;
    }
}
