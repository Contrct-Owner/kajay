namespace Kajay.Workflow.Host.Persistence;

internal sealed class EnvironmentBindingRecord
{
    public required string TenantId { get; set; }

    public required string EnvironmentName { get; set; }

    public required string Name { get; set; }

    public required string Reference { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
