using Elsa.Scheduling.Activities;
using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Activities.Flowchart.Models;
using Elsa.Workflows.Models;
using Elsa.Workflows.Runtime.ActivationValidators;
using Kajay.Workflow.Host.Definitions;
using ElsaEndpoint = Elsa.Workflows.Activities.Flowchart.Models.Endpoint;
using ElsaFlowchart = Elsa.Workflows.Activities.Flowchart.Activities.Flowchart;
using ElsaWorkflow = Elsa.Workflows.Activities.Workflow;

namespace Kajay.Workflow.Host.Workflows;

internal static class ElsaWorkflowCompiler
{
    internal static ElsaWorkflow Compile(WorkflowRelease release)
    {
        Dictionary<string, IActivity> activities = release.Workflow.Steps.ToDictionary(
            step => step.Key,
            CreateActivity,
            StringComparer.Ordinal);
        var start = new Start { Id = "__kajay_start", Name = "Kajay start" };
        List<Connection> connections = CreateConnections(release.Workflow, activities);
        connections.Add(new Connection(
            new ElsaEndpoint(start, "Done"),
            new ElsaEndpoint(activities[release.Workflow.InitialStep])));
        var flowchart = new ElsaFlowchart
        {
            Start = start,
            Activities = [start, .. activities.Values],
            Connections = connections,
        };
        string definitionId = $"kajay-{release.Record.Digest[7..]}";
        return new ElsaWorkflow(flowchart)
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

    private static List<Connection> CreateConnections(
        WorkflowDefinition definition,
        Dictionary<string, IActivity> activities)
    {
        var connections = new List<Connection>();
        foreach (WorkflowStep step in definition.Steps)
        {
            foreach (WorkflowTransition transition in step.Transitions())
            {
                IActivity source = activities[step.Key];
                IActivity target = activities[transition.TargetStepKey];
                connections.Add(transition.Outcome is null
                    ? new Connection(
                        new ElsaEndpoint(source, "Done"),
                        new ElsaEndpoint(target))
                    : new Connection(
                        new ElsaEndpoint(source, transition.Outcome),
                        new ElsaEndpoint(target)));
            }
        }
        return connections;
    }

    private static IActivity CreateActivity(WorkflowStep step)
    {
        return step.Kind switch
        {
            WorkflowStepKind.Survey => Configure(
                new KajaySurveyActivity(step.Key, step.SurveyDefinitionDigest!), step),
            WorkflowStepKind.Delay => CreateDelay(step),
            WorkflowStepKind.Effect => Configure(new KajayEffectActivity(
                step.Key,
                step.EffectType!,
                step.EffectPayload!.ToJsonString()), step),
            WorkflowStepKind.Review => Configure(
                new KajayReviewActivity(step.Key, step.AssignedPermission!), step),
            WorkflowStepKind.End => Configure(new KajayEndActivity(step.Key), step),
            _ => throw new InvalidOperationException(
                $"Unsupported workflow step kind {step.Kind}."),
        };
    }

    private static Sequence CreateDelay(WorkflowStep step)
    {
        return new Sequence
        {
            Id = step.Key,
            Name = step.Key,
            Activities =
            [
                new KajayDelayStartedActivity(step.Key, step.Delay!.Value)
                {
                    Id = $"{step.Key}-started",
                    Name = $"{step.Key} started",
                },
                new Delay(step.Delay.Value)
                {
                    Id = $"{step.Key}-delay",
                    Name = $"{step.Key} delay",
                },
                new KajayDelayCompletedActivity(step.Key, step.Next!)
                {
                    Id = $"{step.Key}-completed",
                    Name = $"{step.Key} completed",
                },
            ],
        };
    }

    private static T Configure<T>(T activity, WorkflowStep step) where T : Activity
    {
        activity.Id = step.Key;
        activity.Name = step.Key;
        return activity;
    }
}
