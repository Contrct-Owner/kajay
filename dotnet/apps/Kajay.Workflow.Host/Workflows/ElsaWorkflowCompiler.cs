using Elsa.Scheduling.Activities;
using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Models;
using Elsa.Workflows.Runtime.ActivationValidators;
using Kajay.Workflow.Host.Definitions;
using ElsaWorkflow = Elsa.Workflows.Activities.Workflow;

namespace Kajay.Workflow.Host.Workflows;

internal static class ElsaWorkflowCompiler
{
    internal static ElsaWorkflow Compile(WorkflowRelease release)
    {
        var activities = new List<IActivity>();
        foreach (WorkflowStep step in release.Workflow.ExecutionSteps())
        {
            AddStep(activities, step);
        }
        string definitionId = $"kajay-{release.Record.Digest[7..]}";
        return new ElsaWorkflow(new Sequence { Activities = activities })
        {
            Identity = new WorkflowIdentity(definitionId, 1, $"{definitionId}-v1", ""),
            Publication = WorkflowPublication.LatestAndPublished,
            Options = new WorkflowOptions
            {
                ActivationStrategyType = typeof(CorrelatedSingletonStrategy),
            },
            Name = $"Kajay {release.Record.ManagedDefinitionName}",
        };
    }

    private static void AddStep(List<IActivity> activities, WorkflowStep step)
    {
        switch (step.Kind)
        {
            case WorkflowStepKind.Survey:
                activities.Add(new KajaySurveyActivity(step.Key, step.SurveyDefinitionDigest!)
                {
                    Id = step.Key,
                    Name = step.Key,
                });
                break;
            case WorkflowStepKind.Delay:
                AddDelay(activities, step);
                break;
            case WorkflowStepKind.Effect:
                activities.Add(new KajayEffectActivity(
                    step.Key,
                    step.EffectType!,
                    step.EffectPayload!.ToJsonString())
                {
                    Id = step.Key,
                    Name = step.Key,
                });
                break;
            case WorkflowStepKind.End:
                activities.Add(new KajayEndActivity(step.Key)
                {
                    Id = step.Key,
                    Name = step.Key,
                });
                break;
            default:
                throw new InvalidOperationException($"Unsupported workflow step kind {step.Kind}.");
        }
    }

    private static void AddDelay(List<IActivity> activities, WorkflowStep step)
    {
        activities.Add(new KajayDelayStartedActivity(step.Key, step.Delay!.Value)
        {
            Id = $"{step.Key}-started",
            Name = $"{step.Key} started",
        });
        activities.Add(new Delay(step.Delay.Value)
        {
            Id = step.Key,
            Name = step.Key,
        });
        activities.Add(new KajayDelayCompletedActivity(step.Key, step.Next!)
        {
            Id = $"{step.Key}-completed",
            Name = $"{step.Key} completed",
        });
    }
}
