namespace Kajay;

/// <summary>Provides the language-neutral contracts embedded in the Kajay package.</summary>
public static class KajayContracts
{
    private const string SurveySchemaResourceName = "Kajay.Core.Contracts.survey-schema.json";
    private const string RuntimeMetadataResourceName = "Kajay.Core.Contracts.runtime-metadata.json";
    private const string RuntimeDiagnosticsResourceName = "Kajay.Core.Contracts.runtime-diagnostics.json";

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
