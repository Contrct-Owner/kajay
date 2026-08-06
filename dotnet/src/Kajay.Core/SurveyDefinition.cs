using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay;

/// <summary>An authoritative survey definition with canonical JSON serialization.</summary>
public sealed class SurveyDefinition
{
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
        var diagnostics = new List<DefinitionDiagnostic>();
        JsonObject canonical = DefinitionReader.Read(input, diagnostics);

        return new SurveyDefinitionParseResult(
            new SurveyDefinition(canonical),
            diagnostics.ToArray());
    }

    /// <summary>Writes the stable JSON representation used for storage and comparison.</summary>
    /// <returns>Minified canonical JSON with deterministic property order.</returns>
    public string ToCanonicalJson()
    {
        return _canonical.ToJsonString();
    }

    /// <summary>Creates an independent mutable survey instance.</summary>
    /// <returns>A survey whose initial state reflects whether pages exist.</returns>
    public Survey CreateSurvey()
    {
        return CreateSurvey(new SurveyOptions());
    }

    /// <summary>Creates an independent mutable survey with host-provided services.</summary>
    /// <param name="options">Explicit clocks and future host services.</param>
    /// <returns>A new survey instance.</returns>
    public Survey CreateSurvey(SurveyOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(options.TimeProvider);
        ArgumentNullException.ThrowIfNull(options.ExpressionFunctions);
        return new Survey(
            SurveyRuntimeDefinition.From(_canonical),
            options.TimeProvider,
            options.ExpressionFunctions);
    }

}
