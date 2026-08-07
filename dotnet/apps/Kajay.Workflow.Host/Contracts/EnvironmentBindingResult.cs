namespace Kajay.Workflow.Host.Contracts;

internal sealed record EnvironmentBindingResult(
    string EnvironmentName,
    string Name,
    long Version,
    string UpdatedBy,
    DateTimeOffset UpdatedAt);
