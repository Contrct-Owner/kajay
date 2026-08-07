namespace Kajay.Workflow.Host.Contracts;

internal sealed record CreateDefinitionReleaseRequest(
    string VersionLabel,
    IReadOnlyList<string?>? RequiredBindings);
