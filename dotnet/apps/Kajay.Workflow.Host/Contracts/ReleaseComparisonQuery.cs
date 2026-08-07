namespace Kajay.Workflow.Host.Contracts;

internal sealed record ReleaseComparisonQuery(
    string EnvironmentName,
    string? BaselineDigest);
