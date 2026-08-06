using System.Text.Json;
using Kajay.Snapshots;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Workflows;

internal static class WorkflowResponseValidator
{
    internal static SurveySnapshot Validate(
        WorkflowRelease release,
        WorkflowStep step,
        string snapshotJson)
    {
        try
        {
            SurveySnapshot snapshot = SurveySnapshot.Parse(snapshotJson);
            Kajay.Survey survey = release.GetSurvey(step.SurveyDefinitionDigest!).CreateSurvey();
            survey.RestoreSnapshot(snapshot);
            return snapshot;
        }
        catch (Exception exception) when (exception is JsonException
            or InvalidOperationException
            or ArgumentException)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status422UnprocessableEntity,
                "invalid-response-snapshot",
                exception.Message);
        }
    }

    internal static void RequireCompleted(
        WorkflowInstanceRecord instance,
        WorkflowRelease release,
        WorkflowStep step)
    {
        if (instance.ResponseSnapshotJson is null)
        {
            throw IncompleteResponse();
        }
        SurveySnapshot snapshot = Validate(release, step, instance.ResponseSnapshotJson);
        Kajay.Survey survey = release.GetSurvey(step.SurveyDefinitionDigest!).CreateSurvey();
        survey.RestoreSnapshot(snapshot);
        if (!survey.IsCompleted)
        {
            throw IncompleteResponse();
        }
    }

    private static WorkflowProblemException IncompleteResponse()
    {
        return new WorkflowProblemException(
            StatusCodes.Status422UnprocessableEntity,
            "survey-response-incomplete",
            "The active survey Response Snapshot is not completed.");
    }
}
