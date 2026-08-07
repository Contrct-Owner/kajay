using Elsa.Workflows.Activities;
using Elsa.Workflows.Management;
using Elsa.Workflows.Management.Filters;
using Elsa.Workflows.Runtime;
using Elsa.Workflows.Runtime.Filters;
using Elsa.Workflows.Runtime.Options;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using ElsaWorkflow = Elsa.Workflows.Activities.Workflow;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class ElsaWorkflowEngine(
    IWorkflowRegistry registry,
    IWorkflowStarter starter,
    IWorkflowResumer resumer,
    IWorkflowInstanceStore instances,
    WorkflowDbContext database)
{
    internal async Task EnsureStartedAsync(
        string tenantId,
        Guid instanceId,
        WorkflowRelease release,
        CancellationToken cancellationToken)
    {
        ElsaWorkflow workflow = await CompileAndRegisterAsync(release, cancellationToken)
            .ConfigureAwait(false);
        string correlationId = instanceId.ToString("N");
        if (await FindAsync(correlationId, cancellationToken).ConfigureAwait(false) is not null)
        {
            return;
        }
        StartWorkflowResponse response = await starter.StartWorkflowAsync(new StartWorkflowRequest
        {
            Workflow = workflow,
            CorrelationId = correlationId,
            Name = $"Kajay {instanceId:N}",
            Properties = ElsaWorkflowContext.CreateProperties(tenantId, instanceId),
        }, cancellationToken).ConfigureAwait(false);
        if (response.CannotStart)
        {
            throw new InvalidOperationException(
                $"Elsa refused to start Kajay Workflow Instance '{instanceId}'.");
        }
    }

    internal Task ResumeSurveyAsync(
        Guid instanceId,
        WorkflowRelease release,
        Guid submissionId,
        string stepKey,
        CancellationToken cancellationToken)
    {
        return ResumeAsync(
            instanceId,
            release,
            ElsaWorkflowBookmarks.Survey(stepKey),
            new Dictionary<string, object>(StringComparer.Ordinal)
            {
                ["submissionId"] = submissionId.ToString("N"),
            },
            cancellationToken);
    }

    internal Task ResumeEffectAsync(
        Guid instanceId,
        WorkflowRelease release,
        string stepKey,
        CancellationToken cancellationToken)
    {
        return ResumeAsync(
            instanceId,
            release,
            ElsaWorkflowBookmarks.Effect(stepKey),
            new Dictionary<string, object>(StringComparer.Ordinal),
            cancellationToken);
    }

    internal Task ResumeReviewAsync(
        Guid instanceId,
        WorkflowRelease release,
        string stepKey,
        CancellationToken cancellationToken)
    {
        return ResumeAsync(
            instanceId,
            release,
            ElsaWorkflowBookmarks.Review(stepKey),
            new Dictionary<string, object>(StringComparer.Ordinal),
            cancellationToken);
    }

    internal async Task EnsureRegisteredAsync(
        WorkflowRelease release,
        CancellationToken cancellationToken)
    {
        _ = await CompileAndRegisterAsync(release, cancellationToken).ConfigureAwait(false);
    }

    private async Task ResumeAsync(
        Guid instanceId,
        WorkflowRelease release,
        string bookmarkName,
        IDictionary<string, object> input,
        CancellationToken cancellationToken)
    {
        _ = await CompileAndRegisterAsync(release, cancellationToken).ConfigureAwait(false);
        var filter = new BookmarkFilter
        {
            CorrelationId = instanceId.ToString("N"),
            Name = bookmarkName,
        };
        var options = new ResumeBookmarkOptions { Input = input };
        var responses = await resumer.ResumeAsync(filter, options, cancellationToken)
            .ConfigureAwait(false);
        if (!responses.Any())
        {
            throw new InvalidOperationException(
                $"Elsa bookmark '{bookmarkName}' for Kajay Workflow Instance "
                + $"'{instanceId}' does not exist.");
        }
    }

    private async Task<ElsaWorkflow> CompileAndRegisterAsync(
        WorkflowRelease release,
        CancellationToken cancellationToken)
    {
        ElsaWorkflow workflow = ElsaWorkflowCompiler.Compile(release);
        string definitionId = workflow.Identity.DefinitionId;
        await using var transaction = await database.Database.BeginTransactionAsync(
            cancellationToken).ConfigureAwait(false);
        _ = await database.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({definitionId}, 0))",
            cancellationToken).ConfigureAwait(false);
        await registry.RegisterAsync(workflow, cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return workflow;
    }

    private ValueTask<Elsa.Workflows.Management.Entities.WorkflowInstance?> FindAsync(
        string correlationId,
        CancellationToken cancellationToken)
    {
        return instances.FindAsync(
            new WorkflowInstanceFilter { CorrelationId = correlationId },
            cancellationToken);
    }
}
