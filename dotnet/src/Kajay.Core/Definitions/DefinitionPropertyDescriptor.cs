using System.Text.Json.Nodes;

namespace Kajay.Definitions;

internal sealed record DefinitionPropertyDescriptor(
    string Name,
    DefinitionPropertyType Type,
    JsonNode? DefaultValue,
    bool IsRequired,
    bool IsLocalizable);
