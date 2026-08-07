using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Persistence;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record SurveySubmissionResult(
    Guid Id,
    Guid WorkflowInstanceId,
    string StepKey,
    int AttemptNumber,
    string DefinitionDigest,
    JsonNode Snapshot,
    string SubmittedBy,
    DateTimeOffset SubmittedAt)
{
    internal static SurveySubmissionResult From(SurveySubmissionRecord submission)
    {
        return new SurveySubmissionResult(
            submission.Id,
            submission.WorkflowInstanceId,
            submission.StepKey,
            submission.AttemptNumber,
            submission.DefinitionDigest,
            JsonNode.Parse(submission.SnapshotJson)!,
            submission.SubmittedBy,
            submission.SubmittedAt);
    }
}
