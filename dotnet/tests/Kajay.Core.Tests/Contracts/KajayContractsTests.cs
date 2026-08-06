using System.Reflection;
using System.Text.Json;

namespace Kajay.Core.Tests;

public sealed class KajayContractsTests
{
    private static readonly (string FileName, Func<Stream> OpenResource)[] ContractResources =
    [
        ("survey-schema.json", KajayContracts.OpenSurveySchema),
        ("runtime-metadata.json", KajayContracts.OpenRuntimeMetadata),
        ("runtime-diagnostics.json", KajayContracts.OpenRuntimeDiagnostics),
    ];

    [Fact(DisplayName = "parity/Q2-contract-resources")]
    public void PackageDeclaresVersionsAndEmbedsOnlyCurrentRepositoryContracts()
    {
        Assert.Equal("urn:kajay:survey-definition:1", KajayContracts.SurveySchemaId);
        Assert.Equal(1, KajayContracts.CurrentSurveySchemaVersion);
        Assert.Equal(1, KajayContracts.RuntimeMetadataContractVersion);
        Assert.Equal(1, KajayContracts.RuntimeDiagnosticsContractVersion);
        Assert.Equal([1], KajayContracts.SupportedSurveySchemaVersions);
        Assert.Equal([1, 2], KajayContracts.SupportedConformanceVersions);
        Assert.Equal(
            typeof(IReadOnlyList<int>),
            typeof(KajayContracts).GetProperty(
                nameof(KajayContracts.SupportedSurveySchemaVersions))?.PropertyType);
        Assert.Equal(
            typeof(IReadOnlyList<int>),
            typeof(KajayContracts).GetProperty(
                nameof(KajayContracts.SupportedConformanceVersions))?.PropertyType);

        Assembly assembly = typeof(KajayContracts).Assembly;
        Assert.Equal(
            [
                "Kajay.Core.Contracts.runtime-diagnostics.json",
                "Kajay.Core.Contracts.runtime-metadata.json",
                "Kajay.Core.Contracts.survey-schema.json",
            ],
            assembly.GetManifestResourceNames().Order(StringComparer.Ordinal));

        foreach ((string fileName, Func<Stream> openResource) in ContractResources)
        {
            string repositoryArtifact = Path.Combine(
                AppContext.BaseDirectory,
                "Contracts",
                fileName);
            byte[] expected = File.ReadAllBytes(repositoryArtifact);
            using Stream actualStream = openResource();
            using var actual = new MemoryStream();
            actualStream.CopyTo(actual);

            Assert.Equal(expected, actual.ToArray());
        }
    }

    [Fact]
    public void EmbeddedSurveySchemaExposesTheAuthoritativeContractIdentity()
    {
        using Stream stream = KajayContracts.OpenSurveySchema();
        using JsonDocument schema = JsonDocument.Parse(stream);

        Assert.Equal(
            KajayContracts.SurveySchemaId,
            schema.RootElement.GetProperty("$id").GetString());
    }

    [Fact]
    public void EmbeddedRuntimeMetadataExposesTheAuthoritativeContractVersion()
    {
        using Stream stream = KajayContracts.OpenRuntimeMetadata();
        using JsonDocument metadata = JsonDocument.Parse(stream);

        Assert.Equal(
            KajayContracts.RuntimeMetadataContractVersion,
            metadata.RootElement.GetProperty("contractVersion").GetInt32());
    }

    [Fact]
    public void EmbeddedRuntimeDiagnosticsExposeTheAuthoritativeContractVersion()
    {
        using Stream stream = KajayContracts.OpenRuntimeDiagnostics();
        using JsonDocument diagnostics = JsonDocument.Parse(stream);

        Assert.Equal(
            KajayContracts.RuntimeDiagnosticsContractVersion,
            diagnostics.RootElement.GetProperty("contractVersion").GetInt32());
    }
}
