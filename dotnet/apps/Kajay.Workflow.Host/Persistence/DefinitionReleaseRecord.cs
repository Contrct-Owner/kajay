namespace Kajay.Workflow.Host.Persistence;

internal sealed class DefinitionReleaseRecord
{
    public Guid Id { get; set; }

    public required string TenantId { get; set; }

    public required string Digest { get; set; }

    public required string ManagedDefinitionName { get; set; }

    public required string VersionLabel { get; set; }

    public int ConformanceVersion { get; set; }

    public required string WorkflowJson { get; set; }

    public required string SurveyDefinitionsJson { get; set; }

    public required string[] RequiredBindings { get; set; }

    public required byte[] Bundle { get; set; }

    public DateTimeOffset InstalledAt { get; set; }
}
