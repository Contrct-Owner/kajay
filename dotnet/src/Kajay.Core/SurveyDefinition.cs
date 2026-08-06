using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay;

/// <summary>An authoritative survey definition with canonical JSON serialization.</summary>
public sealed class SurveyDefinition
{
    private readonly JsonObject _canonical;
    private readonly SurveyDefinitionRegistry _registry;

    private SurveyDefinition(JsonObject canonical, SurveyDefinitionRegistry registry)
    {
        _canonical = canonical;
        _registry = registry;
        DefinitionDigest = Definitions.DefinitionDigest.Compute(ToCanonicalJson());
    }

    /// <summary>Gets the lowercase SHA-256 identity of the canonical definition.</summary>
    public string DefinitionDigest { get; }

    /// <summary>Reads authored JSON into a canonical survey definition.</summary>
    /// <param name="json">A JSON object containing the survey definition.</param>
    /// <returns>The usable definition and every authored diagnostic.</returns>
    public static SurveyDefinitionParseResult Parse(string json)
    {
        return Parse(json, SurveyDefinitionRegistry.Default);
    }

    /// <summary>Reads authored JSON through an immutable host extension registry.</summary>
    /// <param name="json">A JSON object containing the survey definition.</param>
    /// <param name="registry">The metadata and native factories used by this definition.</param>
    /// <returns>The usable definition and every authored diagnostic.</returns>
    public static SurveyDefinitionParseResult Parse(
        string json,
        SurveyDefinitionRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(json);
        ArgumentNullException.ThrowIfNull(registry);
        JsonObject input = JsonNode.Parse(json) as JsonObject
            ?? throw new JsonException("A survey definition must be a JSON object.");
        var diagnostics = new List<DefinitionDiagnostic>();
        JsonObject canonical = DefinitionReader.Read(input, registry.Metadata, diagnostics);

        return new SurveyDefinitionParseResult(
            new SurveyDefinition(canonical, registry),
            diagnostics.ToArray());
    }

    /// <summary>Writes the stable JSON representation used for storage and comparison.</summary>
    /// <returns>Minified canonical JSON with deterministic property order.</returns>
    public string ToCanonicalJson()
    {
        return Definitions.PortableJson.Stringify(_canonical);
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
        ArgumentNullException.ThrowIfNull(options.Endpoints);
        return new Survey(
            SurveyRuntimeDefinition.From(_canonical, _registry),
            DefinitionDigest,
            options.TimeProvider,
            options);
    }

    /// <summary>Creates a survey and awaits its initially reachable host work.</summary>
    /// <param name="options">Explicit clocks and host adapters.</param>
    /// <param name="cancellationToken">Cancels initial host work.</param>
    /// <returns>A fully settled survey.</returns>
    public async Task<Survey> CreateSurveyAsync(
        SurveyOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        Survey survey = CreateSurvey(options ?? new SurveyOptions());
        await survey.SettleAsync(cancellationToken).ConfigureAwait(false);
        return survey;
    }

}
