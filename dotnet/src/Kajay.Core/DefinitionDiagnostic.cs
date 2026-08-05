namespace Kajay;

/// <summary>Describes one authored problem found while reading a survey definition.</summary>
/// <param name="Code">The stable language-neutral diagnostic code.</param>
/// <param name="Path">The JSON Pointer path to the affected value.</param>
/// <param name="Severity">The effect of the problem on the definition.</param>
public sealed record DefinitionDiagnostic(
    string Code,
    string Path,
    DiagnosticSeverity Severity);
