using System.Text.Json;

namespace Kajay.Demo.Api;

internal static class KajayJsonValueAdapter
{
    internal static KajayValue FromJson(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Undefined => KajayValue.Absent,
            JsonValueKind.Null => KajayValue.Null,
            JsonValueKind.True => KajayValue.From(true),
            JsonValueKind.False => KajayValue.From(false),
            JsonValueKind.Number => KajayValue.From(element.GetDouble()),
            JsonValueKind.String => KajayValue.From(element.GetString() ?? string.Empty),
            JsonValueKind.Array => KajayValue.FromArray(
                element.EnumerateArray().Select(FromJson)),
            JsonValueKind.Object => KajayValue.FromObject(
                element.EnumerateObject().Select(property =>
                    new KeyValuePair<string, KajayValue>(property.Name, FromJson(property.Value)))),
            _ => throw new JsonException($"Unsupported JSON value kind {element.ValueKind}."),
        };
    }

    internal static object? ToJson(KajayValue value)
    {
        return value.Kind switch
        {
            KajayValueKind.Absent => null,
            KajayValueKind.Null => null,
            KajayValueKind.Boolean => value.GetBoolean(),
            KajayValueKind.Number => value.GetNumber(),
            KajayValueKind.Text => value.GetString(),
            KajayValueKind.Instant => value.GetInstant().ToString("O"),
            KajayValueKind.Array => value.GetArray().Select(ToJson).ToArray(),
            KajayValueKind.Map => value.GetObject().ToDictionary(
                pair => pair.Key,
                pair => ToJson(pair.Value),
                StringComparer.Ordinal),
            _ => throw new InvalidOperationException($"Unsupported Kajay value kind {value.Kind}."),
        };
    }
}
