namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionProvenanceResult(
    string ManagedDefinitionName,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    string EnvironmentName,
    IReadOnlyList<string> Environments,
    DefinitionActivationStateResult Activation,
    CursorPageResult<DefinitionRevisionHistoryResult> Revisions,
    CursorPageResult<DefinitionReleaseHistoryResult> Releases,
    CursorPageResult<ManagementAuditEventResult> AuditEvents);
