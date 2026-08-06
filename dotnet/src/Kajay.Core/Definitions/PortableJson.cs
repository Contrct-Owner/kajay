using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Definitions;

internal static class PortableJson
{
    internal static string Stringify(JsonNode node)
    {
        ArgumentNullException.ThrowIfNull(node);
        var output = new StringBuilder();
        WriteNode(output, node);
        return output.ToString();
    }

    private static void WriteNode(StringBuilder output, JsonNode? node)
    {
        if (node is null)
        {
            _ = output.Append("null");
            return;
        }
        if (node is JsonObject map)
        {
            WriteObject(output, map);
            return;
        }
        if (node is JsonArray array)
        {
            WriteArray(output, array);
            return;
        }
        WriteValue(output, (JsonValue)node);
    }

    private static void WriteObject(StringBuilder output, JsonObject map)
    {
        _ = output.Append('{');
        bool separator = false;
        foreach ((string name, JsonNode? value) in map)
        {
            if (separator) _ = output.Append(',');
            WriteString(output, name);
            _ = output.Append(':');
            WriteNode(output, value);
            separator = true;
        }
        _ = output.Append('}');
    }

    private static void WriteArray(StringBuilder output, JsonArray array)
    {
        _ = output.Append('[');
        for (int index = 0; index < array.Count; index += 1)
        {
            if (index > 0) _ = output.Append(',');
            WriteNode(output, array[index]);
        }
        _ = output.Append(']');
    }

    private static void WriteValue(StringBuilder output, JsonValue value)
    {
        switch (value.GetValueKind())
        {
            case JsonValueKind.String:
                WriteString(output, value.GetValue<string>());
                break;
            case JsonValueKind.True:
                _ = output.Append("true");
                break;
            case JsonValueKind.False:
                _ = output.Append("false");
                break;
            case JsonValueKind.Number:
                _ = output.Append(FormatNumber(ReadNumber(value)));
                break;
            default:
                throw new JsonException($"Unsupported canonical JSON value {value.GetValueKind()}.");
        }
    }

    private static void WriteString(StringBuilder output, string value)
    {
        _ = output.Append('"');
        for (int index = 0; index < value.Length; index += 1)
        {
            char character = value[index];
            string? escape = character switch
            {
                '"' => "\\\"",
                '\\' => "\\\\",
                '\b' => "\\b",
                '\t' => "\\t",
                '\n' => "\\n",
                '\f' => "\\f",
                '\r' => "\\r",
                _ => null,
            };
            if (escape is not null)
            {
                _ = output.Append(escape);
            }
            else if (character < ' ' || IsLoneSurrogate(value, index))
            {
                _ = output.Append("\\u").Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
            }
            else
            {
                _ = output.Append(character);
            }
        }
        _ = output.Append('"');
    }

    private static bool IsLoneSurrogate(string value, int index)
    {
        char character = value[index];
        if (char.IsLowSurrogate(character))
        {
            return index == 0 || !char.IsHighSurrogate(value[index - 1]);
        }
        return char.IsHighSurrogate(character)
            && (index + 1 == value.Length || !char.IsLowSurrogate(value[index + 1]));
    }

    private static double ReadNumber(JsonValue value)
    {
        if (value.TryGetValue(out double doubleValue)) return doubleValue;
        if (value.TryGetValue(out int intValue)) return intValue;
        if (value.TryGetValue(out long longValue)) return longValue;
        if (value.TryGetValue(out uint uintValue)) return uintValue;
        if (value.TryGetValue(out ulong ulongValue)) return ulongValue;
        if (value.TryGetValue(out float floatValue)) return floatValue;
        if (value.TryGetValue(out decimal decimalValue)) return (double)decimalValue;
        if (value.TryGetValue(out JsonElement element)) return element.GetDouble();
        throw new JsonException("Canonical JSON contains an unreadable number.");
    }

    private static string FormatNumber(double value)
    {
        if (!double.IsFinite(value))
        {
            throw new JsonException("Canonical JSON cannot contain a non-finite number.");
        }
        if (value == 0)
        {
            return "0";
        }
        string roundTrip = value.ToString("R", CultureInfo.InvariantCulture);
        double magnitude = Math.Abs(value);
        return magnitude >= 1e21 || magnitude < 1e-6
            ? ToExponent(roundTrip)
            : ToFixed(roundTrip);
    }

    private static string ToExponent(string roundTrip)
    {
        int exponentAt = roundTrip.IndexOf('E', StringComparison.OrdinalIgnoreCase);
        if (exponentAt < 0)
        {
            return ToExponentFromFixed(roundTrip);
        }
        string mantissa = roundTrip[..exponentAt];
        int exponent = int.Parse(roundTrip[(exponentAt + 1)..], CultureInfo.InvariantCulture);
        return $"{mantissa}e{(exponent >= 0 ? "+" : string.Empty)}{exponent}";
    }

    private static string ToExponentFromFixed(string roundTrip)
    {
        bool negative = roundTrip[0] == '-';
        string unsigned = negative ? roundTrip[1..] : roundTrip;
        int point = unsigned.IndexOf('.', StringComparison.Ordinal);
        int decimalPosition = point < 0 ? unsigned.Length : point;
        string digits = unsigned.Replace(".", string.Empty, StringComparison.Ordinal);
        int first = digits.AsSpan().IndexOfAnyExcept('0');
        int exponent = decimalPosition - first - 1;
        string tail = digits[(first + 1)..].TrimEnd('0');
        string mantissa = tail.Length == 0 ? digits[first].ToString() : $"{digits[first]}.{tail}";
        return $"{(negative ? "-" : string.Empty)}{mantissa}e{(exponent >= 0 ? "+" : string.Empty)}{exponent}";
    }

    private static string ToFixed(string roundTrip)
    {
        int exponentAt = roundTrip.IndexOf('E', StringComparison.OrdinalIgnoreCase);
        if (exponentAt < 0)
        {
            return roundTrip;
        }
        bool negative = roundTrip[0] == '-';
        string mantissa = roundTrip[(negative ? 1 : 0)..exponentAt];
        int exponent = int.Parse(roundTrip[(exponentAt + 1)..], CultureInfo.InvariantCulture);
        int point = mantissa.IndexOf('.', StringComparison.Ordinal);
        int fractionLength = point < 0 ? 0 : mantissa.Length - point - 1;
        string digits = mantissa.Replace(".", string.Empty, StringComparison.Ordinal);
        int decimalPosition = digits.Length - fractionLength + exponent;
        string fixedValue = decimalPosition <= 0
            ? $"0.{new string('0', -decimalPosition)}{digits}"
            : decimalPosition >= digits.Length
                ? $"{digits}{new string('0', decimalPosition - digits.Length)}"
                : $"{digits[..decimalPosition]}.{digits[decimalPosition..]}";
        return negative ? $"-{fixedValue}" : fixedValue;
    }
}
