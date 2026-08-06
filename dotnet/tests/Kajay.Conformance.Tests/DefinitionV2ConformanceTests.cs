using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class DefinitionV2ConformanceTests
{
    [Fact]
    public void UnsupportedPatternIsPreservedAndReported()
    {
        AssertDefinitionCase("unsupported-pattern-is-preserved-and-reported");
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

        Assert.Equal(
            JsonSerializer.Serialize(testCase.GetProperty("canonical")),
            result.Definition.ToCanonicalJson());
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
