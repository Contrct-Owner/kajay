using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class LifecycleConformanceTests
{
    [Fact]
    public void EmptyDefinitionsCreateAnEmptySurvey()
    {
        using JsonDocument corpus = OpenLifecycleCorpus();
        JsonElement scenario = corpus.RootElement
            .GetProperty("scenarios")
            .EnumerateArray()
            .Single(candidate => candidate.GetProperty("id").GetString() == "empty-definition");
        SurveyDefinition definition = SurveyDefinition.Parse(
            scenario.GetProperty("definition").GetRawText()).Definition;

        Survey survey = definition.CreateSurvey();

        Assert.Equal(
            scenario.GetProperty("initialState").GetString(),
            survey.State.ToString().ToLowerInvariant());
    }

    private static JsonDocument OpenLifecycleCorpus()
    {
        string path = Path.Combine(
            AppContext.BaseDirectory,
            "Conformance",
            "v1",
            "lifecycle.json");
        return JsonDocument.Parse(File.ReadAllBytes(path));
    }
}
