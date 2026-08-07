namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionReleaseChangeResult(
    string Kind,
    string Area,
    string Path,
    string? BeforeValue,
    string? AfterValue);
