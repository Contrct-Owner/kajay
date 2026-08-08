using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class ReviewWorkbenchApplication(WorkflowDbContext database)
{
    private const int DefaultPageSize = 20;
    private const int MaximumPageSize = 100;
    private const int MaximumDetailHistory = 100;

    internal async Task<CursorPageResult<ReviewTaskQueueItemResult>> GetPageAsync(
        string tenantId,
        AuthenticatedActor actor,
        ReviewTaskPageQuery request,
        CancellationToken cancellationToken)
    {
        int limit = ReadLimit(request.Limit);
        string status = ReadStatus(request.Status);
        string? managedName = ReadManagedName(request.ManagedDefinitionName);
        ValidateDates(request.CreatedAfter, request.CreatedBefore);
        ReviewTaskPageCursor? cursor = ReadCursor(request.Cursor);
        string[] permissions = actor.Permissions.ToArray();
        IQueryable<ReviewTaskRecord> query = database.ReviewTasks.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && permissions.Contains(item.AssignedPermission));
        query = status == "pending"
            ? query.Where(item => item.Status == "pending")
            : query.Where(item => item.Status != "pending");
        if (request.CreatedAfter is not null)
        {
            query = query.Where(item => item.CreatedAt >= request.CreatedAfter.Value);
        }
        if (request.CreatedBefore is not null)
        {
            query = query.Where(item => item.CreatedAt < request.CreatedBefore.Value);
        }
        if (cursor is not null)
        {
            query = query.Where(item => item.CreatedAt < cursor.Value.CreatedAt
                || (item.CreatedAt == cursor.Value.CreatedAt
                    && item.Id.CompareTo(cursor.Value.Id) < 0));
        }
        IQueryable<WorkflowInstanceRecord> instances = database.WorkflowInstances.AsNoTracking()
            .Where(item => item.TenantId == tenantId);
        if (managedName is not null)
        {
            instances = instances.Where(item => item.ManagedDefinitionName == managedName);
        }
        IQueryable<Guid> instanceIds = instances.Select(item => item.Id);
        ReviewTaskRecord[] facts = await query
            .Where(item => instanceIds.Contains(item.WorkflowInstanceId))
            .OrderByDescending(item => item.CreatedAt)
            .ThenByDescending(item => item.Id)
            .Take(limit + 1)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        ReviewTaskRecord[] page = facts.Take(limit).ToArray();
        string? next = facts.Length > limit
            ? ReviewTaskCursor.Encode(page[^1].CreatedAt, page[^1].Id)
            : null;
        Guid[] pageInstanceIds = page.Select(item => item.WorkflowInstanceId).Distinct().ToArray();
        Dictionary<Guid, WorkflowInstanceRecord> pageInstances = await instances
            .Where(item => pageInstanceIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken).ConfigureAwait(false);
        return new CursorPageResult<ReviewTaskQueueItemResult>(
            page.Select(item => ToQueueItem(item, pageInstances[item.WorkflowInstanceId])).ToArray(),
            next);
    }

    internal async Task<ReviewTaskDetailResult> GetDetailAsync(
        string tenantId,
        AuthenticatedActor actor,
        Guid reviewTaskId,
        CancellationToken cancellationToken)
    {
        ReviewTaskRecord task = await database.ReviewTasks.AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.TenantId == tenantId && item.Id == reviewTaskId,
                cancellationToken).ConfigureAwait(false)
            ?? throw NotFound(reviewTaskId);
        ReviewTaskAuthorization.EnsureAssigned(actor, task);
        WorkflowInstanceRecord instance = await database.WorkflowInstances.AsNoTracking()
            .SingleAsync(
                item => item.TenantId == tenantId && item.Id == task.WorkflowInstanceId,
                cancellationToken).ConfigureAwait(false);
        SurveySubmissionRecord submission = await database.SurveySubmissions.AsNoTracking()
            .SingleAsync(item => item.Id == task.SubmissionId, cancellationToken)
            .ConfigureAwait(false);
        DefinitionReleaseRecord release = await database.DefinitionReleases.AsNoTracking()
            .SingleAsync(
                item => item.TenantId == tenantId && item.Digest == instance.ReleaseDigest,
                cancellationToken).ConfigureAwait(false);
        string definitionJson = DefinitionReleaseStorage.ReadSurveys(release)
            .GetValueOrDefault(submission.DefinitionDigest)
            ?? throw new InvalidDataException(
                $"Release '{release.Digest}' is missing survey '{submission.DefinitionDigest}'.");
        ReviewTaskResult[] roundFacts = await database.ReviewTasks.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.WorkflowInstanceId == task.WorkflowInstanceId
                && item.StepKey == task.StepKey)
            .OrderByDescending(item => item.RoundNumber)
            .Take(MaximumDetailHistory + 1)
            .Select(item => ReviewTaskResult.From(item))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        WorkflowAuditEventResult[] auditFacts = await database.WorkflowAuditEvents.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.WorkflowInstanceId == task.WorkflowInstanceId)
            .OrderByDescending(item => item.Sequence)
            .Take(MaximumDetailHistory + 1)
            .Select(item => WorkflowAuditEventResult.From(item))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        return new ReviewTaskDetailResult(
            ReviewTaskResult.From(task),
            ReviewWorkflowInstanceResult.From(instance),
            SurveySubmissionResult.From(submission),
            JsonNode.Parse(definitionJson)!,
            roundFacts.Take(MaximumDetailHistory).Reverse().ToArray(),
            roundFacts.Length > MaximumDetailHistory,
            auditFacts.Take(MaximumDetailHistory).Reverse().ToArray(),
            auditFacts.Length > MaximumDetailHistory);
    }

    private static ReviewTaskQueueItemResult ToQueueItem(
        ReviewTaskRecord task,
        WorkflowInstanceRecord instance) => new(
        ReviewTaskResult.From(task),
        instance.EnvironmentName,
        instance.ManagedDefinitionName,
        instance.ReleaseDigest,
        instance.Status,
        instance.ActiveStepKey,
        instance.Version);

    private static int ReadLimit(int? value)
    {
        int limit = value ?? DefaultPageSize;
        return limit is >= 1 and <= MaximumPageSize
            ? limit
            : throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-page-limit",
                $"Page limit must be between 1 and {MaximumPageSize}.");
    }

    private static string ReadStatus(string? value)
    {
        string status = string.IsNullOrWhiteSpace(value) ? "pending" : value.Trim().ToLowerInvariant();
        return status is "pending" or "completed"
            ? status
            : throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-review-status",
                "Review Task status must be pending or completed.");
    }

    private static string? ReadManagedName(string? value)
    {
        string? name = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        return name is null || name.Length <= 128
            ? name
            : throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-managed-definition-name",
                "Managed Definition name must contain at most 128 characters.");
    }

    private static void ValidateDates(DateTimeOffset? after, DateTimeOffset? before)
    {
        if (after is not null && before is not null && after >= before)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-review-age-range",
                "CreatedAfter must be earlier than CreatedBefore.");
        }
    }

    private static ReviewTaskPageCursor? ReadCursor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            return ReviewTaskCursor.Decode(value);
        }
        catch (FormatException exception)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-pagination-cursor",
                exception.Message);
        }
    }

    private static WorkflowProblemException NotFound(Guid id) => new(
        StatusCodes.Status404NotFound,
        "review-task-not-found",
        $"Review Task '{id}' does not exist.");

}
