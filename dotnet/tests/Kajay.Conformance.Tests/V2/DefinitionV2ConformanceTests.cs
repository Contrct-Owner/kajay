using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class DefinitionV2ConformanceTests
{
    [Fact]
    public void AFillInTheBlankTemplateRoundTripsWithItsMarkers()
    {
        AssertDefinitionCase("a-fill-in-the-blank-template-round-trips-with-its-markers");
    }

    [Fact]
    public void ATranslationMayMoveABlankButNotRenameOne()
    {
        AssertDefinitionCase("a-translation-may-move-a-blank-but-not-rename-one");
    }

    [Fact]
    public void ElementNamedIntoTheHostScopeIsReportedAndKept()
    {
        AssertDefinitionCase("element-named-into-the-host-scope-is-reported-and-kept");
    }

    [Fact]
    public void UnsupportedPatternIsPreservedAndReported()
    {
        AssertDefinitionCase("unsupported-pattern-is-preserved-and-reported");
    }

    [Fact]
    public void MalformedPatternIsPreservedAndReported()
    {
        AssertDefinitionCase("malformed-pattern-is-preserved-and-reported");
    }

    private static void AssertDefinitionCase(string caseId)
    {
        using JsonDocument corpus = OpenDefinitionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("cases")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == caseId);

        SurveyDefinitionParseResult result = SurveyDefinition.Parse(
            testCase.GetProperty("input").GetRawText());

        using JsonDocument actualCanonical = JsonDocument.Parse(
            result.Definition.ToCanonicalJson());
        Assert.True(
            JsonElement.DeepEquals(
                testCase.GetProperty("canonical"),
                actualCanonical.RootElement));
        Assert.Equal(
            testCase.GetProperty("diagnostics").EnumerateArray().Select(ReadDiagnostic),
            result.Diagnostics.Select(diagnostic =>
                (diagnostic.Code, diagnostic.Path, diagnostic.Severity)));
    }

    private static (string Code, string Path, DiagnosticSeverity Severity) ReadDiagnostic(
        JsonElement diagnostic)
    {
        return (
            diagnostic.GetProperty("code").GetString()!,
            diagnostic.GetProperty("path").GetString()!,
            Enum.Parse<DiagnosticSeverity>(
                diagnostic.GetProperty("severity").GetString()!,
                ignoreCase: true));
    }

    private static JsonDocument OpenDefinitionCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v2",
            "definitions.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }
}
