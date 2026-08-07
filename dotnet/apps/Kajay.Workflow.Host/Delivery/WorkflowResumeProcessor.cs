using Kajay.Workflow.Host.Persistence;
using Kajay.Workflow.Host.Workflows;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class WorkflowResumeProcessor(
    WorkflowDbContext database,
    WorkflowReleaseResolver releases,
    ElsaWorkflowEngine engine,
    WorkflowResumeLeaseStore leases)
{
    internal async Task ResumeNowAsync(Guid recordId, CancellationToken cancellationToken)
    {
        database.ChangeTracker.Clear();
        WorkflowResumeLease? lease = await leases.ClaimAsync(recordId, cancellationToken)
            .ConfigureAwait(false);
        if (lease is not null)
        {
            await ProcessAsync(lease, cancellationToken).ConfigureAwait(false);
        }
    }

    internal async Task ProcessAsync(
        WorkflowResumeLease lease,
        CancellationToken cancellationToken)
    {
        try
        {
            WorkflowInstanceRecord instance = await database.WorkflowInstances
                .AsNoTracking()
                .SingleAsync(
                    item => item.TenantId == lease.TenantId
                        && item.Id == lease.WorkflowInstanceId,
                    cancellationToken).ConfigureAwait(false);
            if (RequiresResume(instance, lease))
            {
                WorkflowRelease release = await releases.ResolveAsync(
                    lease.TenantId, instance.ReleaseDigest, cancellationToken)
                    .ConfigureAwait(false);
                await ResumeAsync(lease, release, cancellationToken).ConfigureAwait(false);
            }
            await leases.CompleteAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            await leases.FailAsync(lease, exception, cancellationToken).ConfigureAwait(false);
            throw;
        }
    }

    private Task ResumeAsync(
        WorkflowResumeLease lease,
        WorkflowRelease release,
        CancellationToken cancellationToken)
    {
        return lease.Kind switch
        {
            "start" => engine.EnsureStartedAsync(
                lease.TenantId,
                lease.WorkflowInstanceId,
                release,
                cancellationToken),
            "survey" => engine.ResumeSurveyAsync(
                lease.WorkflowInstanceId,
                release,
                lease.SubmissionId ?? throw new InvalidOperationException(
                    "A survey resume requires a submission."),
                lease.StepKey,
                cancellationToken),
            "effect" => engine.ResumeEffectAsync(
                lease.WorkflowInstanceId,
                release,
                lease.StepKey,
                cancellationToken),
            _ => throw new InvalidOperationException(
                $"Unknown workflow resume kind '{lease.Kind}'."),
        };
    }

    private static bool RequiresResume(
        WorkflowInstanceRecord instance,
        WorkflowResumeLease lease)
    {
        string status = lease.Kind switch
        {
            "start" => "starting",
            "survey" => "submitted",
            _ => "waiting-effect",
        };
        return string.Equals(instance.Status, status, StringComparison.Ordinal)
            && string.Equals(instance.ActiveStepKey, lease.StepKey, StringComparison.Ordinal);
    }
}
