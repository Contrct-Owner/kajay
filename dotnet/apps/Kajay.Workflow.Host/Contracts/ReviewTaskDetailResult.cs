using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReviewTaskDetailResult(
    ReviewTaskResult Task,
    ReviewWorkflowInstanceResult Instance,
    SurveySubmissionResult Submission,
    JsonNode Definition,
    IReadOnlyList<ReviewTaskResult> ReviewRounds,
    bool ReviewRoundsTruncated,
    IReadOnlyList<WorkflowAuditEventResult> AuditHistory,
    bool AuditHistoryTruncated);
