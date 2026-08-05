using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class DefinitionConformanceTests
{
    [Fact]
    public void MinimalDefinitionCanonicalizesThroughThePublicDefinitionSeam()
    {
        AssertDefinitionCase("minimal-definition");
    }

    [Fact]
    public void ExplicitDefinitionDefaultsAreElided()
    {
        AssertDefinitionCase("explicit-defaults-are-elided");
    }

    [Fact]
    public void UnknownPropertiesArePreservedAndReported()
    {
        AssertDefinitionCase("unknown-properties-round-trip");
    }

    [Fact]
    public void WrongPropertyTypesAreReportedAndIgnored()
    {
        AssertDefinitionCase("wrong-property-type-is-reported-and-ignored");
    }

    [Fact]
    public void ScalarChoiceShorthandExpandsToCanonicalChildren()
    {
        AssertDefinitionCase("scalar-child-shorthand-expands");
    }

    [Fact]
    public void QuizPropertiesRoundTripInMetadataOrder()
    {
        AssertDefinitionCase("quiz-properties-round-trip");
    }

    [Fact]
    public void LocalizedTextIsPreservedOnlyForLocalizableProperties()
    {
        AssertDefinitionCase("localized-strings-round-trip");
    }

    private static void AssertDefinitionCase(string id)
    {
        using JsonDocument corpus = OpenDefinitionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("cases")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == id);

        SurveyDefinitionParseResult result = SurveyDefinition.Parse(
            testCase.GetProperty("input").GetRawText());

        Assert.Equal(
            JsonSerializer.Serialize(testCase.GetProperty("canonical")),
            result.Definition.ToCanonicalJson());
        AssertDiagnostics(testCase.GetProperty("diagnostics"), result.Diagnostics);

        string canonical = result.Definition.ToCanonicalJson();
        SurveyDefinitionParseResult fixedPoint = SurveyDefinition.Parse(canonical);
        Assert.Equal(canonical, fixedPoint.Definition.ToCanonicalJson());
    }

    private static void AssertDiagnostics(
        JsonElement expected,
        IReadOnlyList<DefinitionDiagnostic> actual)
    {
        Assert.Equal(expected.GetArrayLength(), actual.Count);
        int index = 0;
        foreach (JsonElement expectedDiagnostic in expected.EnumerateArray())
        {
            DefinitionDiagnostic actualDiagnostic = actual[index];
            Assert.Equal(expectedDiagnostic.GetProperty("code").GetString(), actualDiagnostic.Code);
            Assert.Equal(expectedDiagnostic.GetProperty("path").GetString(), actualDiagnostic.Path);
            Assert.Equal(
                expectedDiagnostic.GetProperty("severity").GetString(),
                actualDiagnostic.Severity.ToString().ToLowerInvariant());
            index += 1;
        }
    }

    private static JsonDocument OpenDefinitionCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v1",
            "definitions.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }
}
