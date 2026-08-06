namespace Kajay.Workflow.Host.Persistence;

internal sealed class ActivationRecord
{
    public required string TenantId { get; set; }

    public required string EnvironmentName { get; set; }

    public required string ManagedDefinitionName { get; set; }

    public required string ReleaseDigest { get; set; }

    public long Version { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTimeOffset ActivatedAt { get; set; }
}
