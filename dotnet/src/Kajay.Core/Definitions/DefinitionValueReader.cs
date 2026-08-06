using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Definitions;

internal static class DefinitionValueReader
{
    internal static bool MatchesPropertyType(
        JsonNode? value,
        DefinitionPropertyDescriptor descriptor)
    {
        if (descriptor.IsLocalizable && IsLocalizedText(value))
        {
            return true;
        }
        if (descriptor.Type is DefinitionPropertyType.Json)
        {
            return true;
        }
        if (value is not JsonValue jsonValue)
        {
            return false;
        }

        JsonValueKind kind = jsonValue.GetValueKind();
        return descriptor.Type switch
        {
            DefinitionPropertyType.String => kind is JsonValueKind.String,
            DefinitionPropertyType.Number => kind is JsonValueKind.Number
                && jsonValue.TryGetValue(out double number)
                && double.IsFinite(number),
            DefinitionPropertyType.Boolean => kind is JsonValueKind.True or JsonValueKind.False,
            DefinitionPropertyType.Value => kind is JsonValueKind.String
                or JsonValueKind.True
                or JsonValueKind.False
                || kind is JsonValueKind.Number
                && jsonValue.TryGetValue(out double scalarNumber)
                && double.IsFinite(scalarNumber),
            DefinitionPropertyType.Json => true,
            _ => false,
        };
    }

    private static bool IsLocalizedText(JsonNode? value)
    {
        return value is JsonObject localized
            && localized.All(entry => entry.Value is JsonValue item
                && item.GetValueKind() is JsonValueKind.String);
    }
}
