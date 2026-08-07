using Kajay.Workflow.Host.Contracts;

namespace Kajay.Workflow.Host.Definitions;

internal sealed record DefinitionReleaseDifference(
    IReadOnlyList<DefinitionReleaseChangeResult> Changes,
    bool Truncated);
