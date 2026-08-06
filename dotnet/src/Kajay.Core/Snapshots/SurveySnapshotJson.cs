using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Snapshots;

internal static class SurveySnapshotJson
{
    internal static SurveySnapshot Parse(string json)
    {
        ArgumentNullException.ThrowIfNull(json);
        JsonObject root = JsonNode.Parse(json) as JsonObject
            ?? throw new JsonException("A Response Snapshot must be a JSON object.");
        int formatVersion = ReadInt(root, "formatVersion");
        if (formatVersion != 1)
        {
            throw new UnsupportedSurveySnapshotVersionException(formatVersion);
        }
        int conformanceVersion = ReadInt(root, "conformanceVersion");
        if (conformanceVersion != 2)
        {
            throw new JsonException(
                $"Response Snapshot conformance version {conformanceVersion} is not supported.");
        }

        string digest = ReadString(root, "definitionDigest");
        ValidateDigest(digest);
        JsonObject dataNode = root["data"] as JsonObject
            ?? throw new JsonException("A Response Snapshot data property must be an object.");
        Dictionary<string, KajayValue> data = dataNode.ToDictionary(
            property => property.Key,
            property => ReadValue(property.Value),
            StringComparer.Ordinal);
        SurveyState lifecycle = ReadLifecycle(ReadString(root, "lifecycle"));
        SurveyTimerAnchors? timer = ReadTimer(root["timer"]);
        ValidateLifecycleTimer(lifecycle, timer);
        return new SurveySnapshot(
            digest,
            data,
            ReadString(root, "pageName"),
            ReadString(root, "locale"),
            lifecycle,
            timer);
    }

    internal static string Write(SurveySnapshot snapshot)
    {
        var data = new JsonObject();
        foreach ((string name, KajayValue value) in snapshot.Data)
        {
            data[name] = WriteValue(value);
        }
        var root = new JsonObject
        {
            ["formatVersion"] = snapshot.FormatVersion,
            ["definitionDigest"] = snapshot.DefinitionDigest,
            ["conformanceVersion"] = snapshot.ConformanceVersion,
            ["data"] = data,
            ["pageName"] = snapshot.PageName,
            ["locale"] = snapshot.Locale,
            ["lifecycle"] = WriteLifecycle(snapshot.Lifecycle),
            ["timer"] = WriteTimer(snapshot.Timer),
        };
        return Definitions.PortableJson.Stringify(root);
    }

    private static KajayValue ReadValue(JsonNode? node)
    {
        JsonObject tagged = node as JsonObject
            ?? throw new JsonException("A Response Snapshot value must be a tagged object.");
        string kind = ReadString(tagged, "kind");
        return kind switch
        {
            "absent" => KajayValue.Absent,
            "json" => ReadScalar(tagged["value"]),
            "instant" => KajayValue.From(ReadInstant(ReadString(tagged, "value"))),
            "array" => KajayValue.FromArray(ReadArray(tagged["value"])),
            "object" => KajayValue.FromObject(ReadObject(tagged["value"])),
            _ => throw new JsonException($"Unknown Response Snapshot value kind '{kind}'."),
        };
    }

    private static KajayValue ReadScalar(JsonNode? node)
    {
        if (node is null)
        {
            return KajayValue.Null;
        }
        if (node is not JsonValue value)
        {
            throw new JsonException("A tagged JSON snapshot value must be a scalar.");
        }
        return value.GetValueKind() switch
        {
            JsonValueKind.True => KajayValue.From(true),
            JsonValueKind.False => KajayValue.From(false),
            JsonValueKind.Number when value.TryGetValue(out double number) && double.IsFinite(number)
                => KajayValue.From(number),
            JsonValueKind.String => KajayValue.From(value.GetValue<string>()),
            _ => throw new JsonException("A tagged JSON snapshot value is invalid."),
        };
    }

    private static KajayValue[] ReadArray(JsonNode? node)
    {
        JsonArray values = node as JsonArray
            ?? throw new JsonException("A tagged array snapshot value must contain an array.");
        return values.Select(ReadValue).ToArray();
    }

    private static KeyValuePair<string, KajayValue>[] ReadObject(JsonNode? node)
    {
        JsonObject values = node as JsonObject
            ?? throw new JsonException("A tagged object snapshot value must contain an object.");
        return values.Select(property =>
            new KeyValuePair<string, KajayValue>(property.Key, ReadValue(property.Value))).ToArray();
    }

    private static JsonObject WriteValue(KajayValue value)
    {
        return value.Kind switch
        {
            KajayValueKind.Absent => Tagged("absent"),
            KajayValueKind.Null => Tagged("json", null),
            KajayValueKind.Boolean => Tagged("json", value.GetBoolean()),
            KajayValueKind.Number => Tagged("json", value.GetNumber()),
            KajayValueKind.Text => Tagged("json", value.GetString()),
            KajayValueKind.Instant => Tagged("instant", WriteInstant(value.GetInstant())),
            KajayValueKind.Array => TaggedArray(value.GetArray()),
            KajayValueKind.Map => TaggedObject(value.GetObject()),
            _ => throw new InvalidOperationException($"Unsupported Kajay value kind {value.Kind}."),
        };
    }

    private static JsonObject Tagged(string kind, JsonNode? value = null)
    {
        var tagged = new JsonObject { ["kind"] = kind };
        if (!string.Equals(kind, "absent", StringComparison.Ordinal))
        {
            tagged["value"] = value;
        }
        return tagged;
    }

    private static JsonObject TaggedArray(IReadOnlyList<KajayValue> values)
    {
        var array = new JsonArray(values.Select(value => (JsonNode?)WriteValue(value)).ToArray());
        return Tagged("array", array);
    }

    private static JsonObject TaggedObject(IReadOnlyDictionary<string, KajayValue> values)
    {
        var map = new JsonObject();
        foreach ((string name, KajayValue value) in values)
        {
            map[name] = WriteValue(value);
        }
        return Tagged("object", map);
    }

    private static SurveyTimerAnchors? ReadTimer(JsonNode? node)
    {
        if (node is null)
        {
            return null;
        }
        JsonObject timer = node as JsonObject
            ?? throw new JsonException("A Response Snapshot timer must be null or an object.");
        DateTimeOffset survey = ReadInstant(ReadString(timer, "surveyStartedAt"));
        DateTimeOffset page = ReadInstant(ReadString(timer, "pageStartedAt"));
        if (page < survey)
        {
            throw new JsonException("A page timer cannot start before its survey timer.");
        }
        return new SurveyTimerAnchors(survey, page);
    }

    private static JsonObject? WriteTimer(SurveyTimerAnchors? timer)
    {
        return timer is null ? null : new JsonObject
        {
            ["surveyStartedAt"] = WriteInstant(timer.SurveyStartedAt),
            ["pageStartedAt"] = WriteInstant(timer.PageStartedAt),
        };
    }

    private static DateTimeOffset ReadInstant(string value)
    {
        const string Format = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";
        if (!DateTimeOffset.TryParseExact(
            value,
            Format,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out DateTimeOffset instant))
        {
            throw new JsonException($"Invalid Response Snapshot instant '{value}'.");
        }
        return instant;
    }

    private static string WriteInstant(DateTimeOffset value)
    {
        return value.ToUniversalTime().ToString(
            "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
            CultureInfo.InvariantCulture);
    }

    private static int ReadInt(JsonObject root, string name)
    {
        return root[name] is JsonValue value && value.TryGetValue(out int result)
            ? result
            : throw new JsonException($"A Response Snapshot {name} property must be an integer.");
    }

    private static string ReadString(JsonObject root, string name)
    {
        return root[name] is JsonValue value && value.TryGetValue(out string? result)
            ? result
            : throw new JsonException($"A Response Snapshot {name} property must be a string.");
    }

    private static SurveyState ReadLifecycle(string value)
    {
        return value switch
        {
            "empty" => SurveyState.Empty,
            "running" => SurveyState.Running,
            "preview" => SurveyState.Preview,
            "completed" => SurveyState.Completed,
            _ => throw new JsonException($"Unknown durable survey lifecycle '{value}'."),
        };
    }

    private static string WriteLifecycle(SurveyState value)
    {
        return value switch
        {
            SurveyState.Empty => "empty",
            SurveyState.Running => "running",
            SurveyState.Preview => "preview",
            SurveyState.Completed => "completed",
            _ => throw new InvalidOperationException($"Survey lifecycle {value} is not durable."),
        };
    }

    private static void ValidateDigest(string value)
    {
        bool valid = value.Length == 71
            && value.StartsWith("sha256:", StringComparison.Ordinal)
            && value.AsSpan(7).ToString().All(
                character => character is >= '0' and <= '9' or >= 'a' and <= 'f');
        if (!valid)
        {
            throw new JsonException("A Response Snapshot definition digest is invalid.");
        }
    }

    private static void ValidateLifecycleTimer(SurveyState lifecycle, SurveyTimerAnchors? timer)
    {
        if (lifecycle is SurveyState.Completed && timer is not null)
        {
            throw new JsonException("A completed Response Snapshot cannot have a running timer.");
        }
    }
}
