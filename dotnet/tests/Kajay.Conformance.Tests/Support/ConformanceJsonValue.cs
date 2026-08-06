using System.Globalization;
using System.Text.Json;

namespace Kajay.Conformance.Tests;

internal static class ConformanceJsonValue
{
    public static IReadOnlyDictionary<string, KajayValue> ReadObject(JsonElement value)
    {
        return value.EnumerateObject().ToDictionary(
            property => property.Name,
            property => Read(property.Value),
            StringComparer.Ordinal);
    }

    public static KajayValue ReadTagged(JsonElement value)
    {
        return value.GetProperty("kind").GetString() switch
        {
            "undefined" => KajayValue.Absent,
            "json" => Read(value.GetProperty("value")),
            "date" => KajayValue.From(DateTimeOffset.Parse(
                value.GetProperty("value").GetString()!,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind)),
            string kind => throw new InvalidDataException($"Unknown tagged value kind '{kind}'."),
            null => throw new InvalidDataException("A tagged value kind cannot be null."),
        };
    }

    private static KajayValue Read(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.Null => KajayValue.Null,
            JsonValueKind.True => KajayValue.From(true),
            JsonValueKind.False => KajayValue.From(false),
            JsonValueKind.Number => KajayValue.From(value.GetDouble()),
            JsonValueKind.String => KajayValue.From(value.GetString()!),
            JsonValueKind.Array => KajayValue.FromArray(value.EnumerateArray().Select(Read)),
            JsonValueKind.Object => KajayValue.FromObject(ReadObject(value)),
            _ => throw new InvalidDataException(
                $"Unsupported JSON value kind '{value.ValueKind}'."),
        };
    }
}
