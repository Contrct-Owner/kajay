namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionReleaseComparisonResult(
    string EnvironmentName,
    DefinitionReleaseComparisonTargetResult? Baseline,
    DefinitionReleaseComparisonTargetResult Target,
    bool InitialRelease,
    DefinitionReleaseChangeSummaryResult Summary,
    IReadOnlyList<DefinitionReleaseChangeResult> Changes,
    bool Truncated);
