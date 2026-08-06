using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Workflows;

internal sealed class WorkflowStepEntry(WorkflowDbContext database)
{
    internal void Enter(
        WorkflowInstanceRecord instance,
        WorkflowRelease release,
        string stepKey,
        DateTimeOffset now)
    {
        WorkflowStep step = release.Workflow.GetStep(stepKey);
        instance.ActiveStepKey = step.Key;
        instance.ResponseSnapshotJson = null;
        switch (step.Kind)
        {
            case WorkflowStepKind.Survey:
                EnterSurvey(instance, release, step);
                break;
            case WorkflowStepKind.Delay:
                EnterDelay(instance, step, now);
                break;
            case WorkflowStepKind.Effect:
                EnterEffect(instance, step, now);
                break;
            case WorkflowStepKind.End:
                instance.Status = "completed";
                instance.CompletedAt = now;
                break;
            default:
                throw new InvalidOperationException($"Unsupported workflow step kind {step.Kind}.");
        }
    }

    private static void EnterSurvey(
        WorkflowInstanceRecord instance,
        WorkflowRelease release,
        WorkflowStep step)
    {
        Kajay.Survey survey = release.GetSurvey(step.SurveyDefinitionDigest!).CreateSurvey();
        instance.ResponseSnapshotJson = survey.CreateSnapshot().ToJson();
        instance.Status = "active";
    }

    private void EnterDelay(
        WorkflowInstanceRecord instance,
        WorkflowStep step,
        DateTimeOffset now)
    {
        instance.Status = "waiting-delay";
        database.ScheduledActions.Add(new ScheduledActionRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = instance.TenantId,
            WorkflowInstanceId = instance.Id,
            ActionId = $"{instance.Id:N}:{step.Key}:timer",
            StepKey = step.Key,
            Status = "pending",
            DueAt = now + step.Delay!.Value,
            CreatedAt = now,
        });
    }

    private void EnterEffect(
        WorkflowInstanceRecord instance,
        WorkflowStep step,
        DateTimeOffset now)
    {
        instance.Status = "waiting-effect";
        database.OutboxMessages.Add(new OutboxMessageRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = instance.TenantId,
            WorkflowInstanceId = instance.Id,
            EffectId = $"{instance.Id:N}:{step.Key}:effect",
            EffectType = step.EffectType!,
            PayloadJson = step.EffectPayload!.ToJsonString(),
            Status = "pending",
            AvailableAt = now,
            CreatedAt = now,
        });
    }
}
