namespace Kajay.Workflow.Host.Contracts;

internal sealed record EnvironmentResult(
    string Name,
    string DisplayName,
    bool RequiresApproval,
    int Position,
    long Version,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    string UpdatedBy,
    DateTimeOffset UpdatedAt);
