using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record DefinitionPropertyDescriptor(
    string Name,
    DefinitionPropertyType Type,
    JsonNode? DefaultValue,
    bool IsRequired,
    bool IsLocalizable);
