using System.Text.Json.Nodes;

namespace Kajay.Demo.Api;

public sealed record DemoDefinitionResult(
    string Runtime,
    bool Accepted,
    JsonNode? Definition,
    IReadOnlyList<DemoDiagnostic> Diagnostics);
