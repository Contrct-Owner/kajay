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

    private static void AssertDefinitionCase(string id)
    {
        using JsonDocument corpus = OpenDefinitionCorpus();
        JsonElement testCase = corpus.RootElement
            .GetProperty("cases")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == id);

        SurveyDefinitionParseResult result = SurveyDefinition.Parse(
            testCase.GetProperty("input").GetRawText());

        Assert.Empty(result.Diagnostics);
        Assert.Equal(
            JsonSerializer.Serialize(testCase.GetProperty("canonical")),
            result.Definition.ToCanonicalJson());
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
