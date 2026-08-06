namespace Kajay;

/// <summary>The usable definition and all diagnostics produced while reading it.</summary>
/// <param name="Definition">The parsed survey definition.</param>
/// <param name="Diagnostics">Authored problems in deterministic discovery order.</param>
public sealed record SurveyDefinitionParseResult(
    SurveyDefinition Definition,
    IReadOnlyList<DefinitionDiagnostic> Diagnostics);
