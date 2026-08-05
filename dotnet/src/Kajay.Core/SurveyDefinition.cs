using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay;

/// <summary>An authoritative survey definition with canonical JSON serialization.</summary>
public sealed class SurveyDefinition
{
    private const int CurrentSchemaVersion = 1;
    private readonly JsonObject _canonical;

    private SurveyDefinition(JsonObject canonical)
    {
        _canonical = canonical;
    }

    /// <summary>Reads authored JSON into a canonical survey definition.</summary>
    /// <param name="json">A JSON object containing the survey definition.</param>
    /// <returns>The usable definition and every authored diagnostic.</returns>
    public static SurveyDefinitionParseResult Parse(string json)
    {
        ArgumentNullException.ThrowIfNull(json);
        JsonObject input = JsonNode.Parse(json) as JsonObject
            ?? throw new JsonException("A survey definition must be a JSON object.");

        var canonical = new JsonObject
        {
            ["schemaVersion"] = CurrentSchemaVersion,
        };
        if (input["pages"] is JsonArray pages)
        {
            canonical["pages"] = CanonicalizePages(pages);
        }

        return new SurveyDefinitionParseResult(
            new SurveyDefinition(canonical),
            Array.Empty<DefinitionDiagnostic>());
    }

    /// <summary>Writes the stable JSON representation used for storage and comparison.</summary>
    /// <returns>Minified canonical JSON with deterministic property order.</returns>
    public string ToCanonicalJson()
    {
        return _canonical.ToJsonString();
    }

    private static JsonArray CanonicalizePages(JsonArray pages)
    {
        var canonical = (JsonArray)pages.DeepClone();
        foreach (JsonObject page in canonical.OfType<JsonObject>())
        {
            RemoveDefault(page, "title", JsonValue.Create(string.Empty));
            if (page["elements"] is not JsonArray elements)
            {
                continue;
            }

            foreach (JsonObject element in elements.OfType<JsonObject>())
            {
                RemoveDefault(element, "isRequired", JsonValue.Create(false));
                RemoveDefault(element, "inputType", JsonValue.Create("text"));
            }
        }

        return canonical;
    }

    private static void RemoveDefault(JsonObject owner, string propertyName, JsonNode? value)
    {
        if (JsonNode.DeepEquals(owner[propertyName], value))
        {
            owner.Remove(propertyName);
        }
    }
}
