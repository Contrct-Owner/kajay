namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionProvenanceResult(
    string ManagedDefinitionName,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    string EnvironmentName,
    IReadOnlyList<string> Environments,
    DefinitionActivationStateResult Activation,
    IReadOnlyList<DefinitionRevisionHistoryResult> Revisions,
    IReadOnlyList<DefinitionReleaseHistoryResult> Releases,
    IReadOnlyList<ManagementAuditEventResult> AuditEvents);
