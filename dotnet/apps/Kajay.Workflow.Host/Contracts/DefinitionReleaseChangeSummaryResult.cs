namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionReleaseChangeSummaryResult(
    int Added,
    int Removed,
    int Changed,
    int Total);
