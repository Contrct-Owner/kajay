using System.Text.Json;

namespace Kajay.Core.Tests;

public sealed class KajayContractsTests
{
    [Fact]
    public void EmbeddedSurveySchemaExposesTheAuthoritativeContractIdentity()
    {
        using Stream stream = KajayContracts.OpenSurveySchema();
        using JsonDocument schema = JsonDocument.Parse(stream);

        Assert.Equal(
            "urn:kajay:survey-definition:1",
            schema.RootElement.GetProperty("$id").GetString());
    }

    [Fact]
    public void EmbeddedRuntimeMetadataExposesTheAuthoritativeContractVersion()
    {
        using Stream stream = KajayContracts.OpenRuntimeMetadata();
        using JsonDocument metadata = JsonDocument.Parse(stream);

        Assert.Equal(1, metadata.RootElement.GetProperty("contractVersion").GetInt32());
    }

    [Fact]
    public void EmbeddedRuntimeDiagnosticsExposeTheAuthoritativeContractVersion()
    {
        using Stream stream = KajayContracts.OpenRuntimeDiagnostics();
        using JsonDocument diagnostics = JsonDocument.Parse(stream);

        Assert.Equal(1, diagnostics.RootElement.GetProperty("contractVersion").GetInt32());
    }
}
