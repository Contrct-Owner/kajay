namespace Kajay;

/// <summary>Provides the language-neutral contracts embedded in the Kajay package.</summary>
public static class KajayContracts
{
    private const string SurveySchemaResourceName = "Kajay.Core.Contracts.survey-schema.json";
    private const string RuntimeMetadataResourceName = "Kajay.Core.Contracts.runtime-metadata.json";
    private const string RuntimeDiagnosticsResourceName = "Kajay.Core.Contracts.runtime-diagnostics.json";

    /// <summary>Gets the identity of the current survey definition schema.</summary>
    public static string SurveySchemaId { get; } = "urn:kajay:survey-definition:1";

    /// <summary>Gets the current survey definition schema version.</summary>
    public static int CurrentSurveySchemaVersion { get; } = 1;

    /// <summary>Gets the runtime metadata contract version.</summary>
    public static int RuntimeMetadataContractVersion { get; } = 1;

    /// <summary>Gets the runtime diagnostic contract version.</summary>
    public static int RuntimeDiagnosticsContractVersion { get; } = 1;

    /// <summary>Gets the survey definition schema versions implemented by this package.</summary>
    public static IReadOnlyList<int> SupportedSurveySchemaVersions { get; } =
        Array.AsReadOnly([CurrentSurveySchemaVersion]);

    /// <summary>Gets the cross-language conformance versions implemented by this package.</summary>
    public static IReadOnlyList<int> SupportedConformanceVersions { get; } =
        Array.AsReadOnly([1, 2]);

    /// <summary>Opens the authoritative JSON Schema for a Kajay survey definition.</summary>
    /// <returns>A new readable stream owned by the caller.</returns>
    public static Stream OpenSurveySchema()
    {
        return OpenResource(SurveySchemaResourceName);
    }

    /// <summary>Opens the generated runtime metadata manifest.</summary>
    /// <returns>A new readable stream owned by the caller.</returns>
    public static Stream OpenRuntimeMetadata()
    {
        return OpenResource(RuntimeMetadataResourceName);
    }

    /// <summary>Opens the stable runtime diagnostic catalog.</summary>
    /// <returns>A new readable stream owned by the caller.</returns>
    public static Stream OpenRuntimeDiagnostics()
    {
        return OpenResource(RuntimeDiagnosticsResourceName);
    }

    private static Stream OpenResource(string resourceName)
    {
        return typeof(KajayContracts).Assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Embedded contract resource '{resourceName}' is missing.");
    }
}
