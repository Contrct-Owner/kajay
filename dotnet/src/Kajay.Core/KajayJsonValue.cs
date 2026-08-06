using System.Text.Json.Nodes;

namespace Kajay;

internal static class KajayJsonValue
{
    public static KajayValue From(JsonNode? node)
    {
        if (node is null)
        {
            return KajayValue.Null;
        }

        if (node is JsonArray array)
        {
            return KajayValue.FromArray(array.Select(From));
        }

        if (node is JsonObject map)
        {
            return KajayValue.FromObject(map.Select(property =>
                new KeyValuePair<string, KajayValue>(
                    property.Key,
                    From(property.Value))));
        }

        JsonValue value = (JsonValue)node;
        if (value.TryGetValue(out bool boolean))
        {
            return KajayValue.From(boolean);
        }

        if (value.TryGetValue(out double number))
        {
            return KajayValue.From(number);
        }

        return KajayValue.From(value.GetValue<string>());
    }
}
