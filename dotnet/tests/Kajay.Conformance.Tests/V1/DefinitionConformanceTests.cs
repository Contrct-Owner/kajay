using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class DefinitionConformanceTests
{
    [Fact(DisplayName = "parity/Q3-definitions")]
    public void GeneratedRegistryDrivesNestedDefinitionsAndPreservesExtensions()
    {
        const string input = """
            {
              "description": "Registry driven",
              "questionsOnPageMode": "singlePage",
              "pages": [
                {
                  "name": "p1",
                  "colCount": 2,
                  "elements": [
                    {
                      "type": "panel",
                      "name": "group",
                      "elements": [
                        {
                          "type": "text",
                          "name": "q1",
                          "placeholder": { "default": "Answer", "fr": "R\u00e9ponse" },
                          "x/extension~": { "keep": [1, 2, 3] }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
            """;

        SurveyDefinitionParseResult result = SurveyDefinition.Parse(input);

        DefinitionDiagnostic diagnostic = Assert.Single(result.Diagnostics);
        Assert.Equal("unknown-property", diagnostic.Code);
        Assert.Equal(
            "/pages/0/elements/0/elements/0/x~1extension~0",
            diagnostic.Path);
        Assert.Equal(DiagnosticSeverity.Warning, diagnostic.Severity);

        using JsonDocument canonical = JsonDocument.Parse(result.Definition.ToCanonicalJson());
        JsonElement root = canonical.RootElement;
        Assert.Equal("Registry driven", root.GetProperty("description").GetString());
        Assert.Equal("singlePage", root.GetProperty("questionsOnPageMode").GetString());
        JsonElement page = root.GetProperty("pages")[0];
        Assert.Equal(2, page.GetProperty("colCount").GetInt32());
        JsonElement question = page.GetProperty("elements")[0].GetProperty("elements")[0];
        Assert.Equal("R\u00e9ponse", question.GetProperty("placeholder").GetProperty("fr").GetString());
        Assert.Equal(3, question.GetProperty("x/extension~").GetProperty("keep").GetArrayLength());

        string firstCanonical = result.Definition.ToCanonicalJson();
        SurveyDefinitionParseResult fixedPoint = SurveyDefinition.Parse(firstCanonical);
        Assert.Equal(firstCanonical, fixedPoint.Definition.ToCanonicalJson());
    }

    [Fact]
    public void UnsupportedSchemaVersionsAreRejectedExplicitly()
    {
        UnsupportedSurveySchemaVersionException exception = Assert.Throws<
            UnsupportedSurveySchemaVersionException>(
                () => SurveyDefinition.Parse("""{"schemaVersion":2}"""));

        Assert.Equal(2, exception.DeclaredVersion);
        Assert.Throws<JsonException>(
            () => SurveyDefinition.Parse("""{"schemaVersion":"1"}"""));
    }

    [Fact]
    public void InvalidCollectionsAndElementsAreReportedAndIgnored()
    {
        const string input = """
            {
              "pages": [
                false,
                {
                  "name": "p1",
                  "elements": [17, { "type": "not-registered", "name": "q1" }]
                }
              ]
            }
            """;

        SurveyDefinitionParseResult result = SurveyDefinition.Parse(input);

        Assert.Equal(
            [
                new DefinitionDiagnostic("invalid-element", "/pages/0", DiagnosticSeverity.Error),
                new DefinitionDiagnostic(
                    "invalid-element",
                    "/pages/1/elements/0",
                    DiagnosticSeverity.Error),
                new DefinitionDiagnostic(
                    "unknown-element-type",
                    "/pages/1/elements/1",
                    DiagnosticSeverity.Error),
            ],
            result.Diagnostics);
        Assert.Equal(
            """{"schemaVersion":1,"pages":[{"name":"p1"}]}""",
            result.Definition.ToCanonicalJson());

        SurveyDefinitionParseResult invalidCollection = SurveyDefinition.Parse(
            """{"pages":{"name":"p1"}}""");
        Assert.Equal(
            new DefinitionDiagnostic(
                "invalid-child-collection",
                "/pages",
                DiagnosticSeverity.Error),
            Assert.Single(invalidCollection.Diagnostics));
        Assert.Equal("""{"schemaVersion":1}""", invalidCollection.Definition.ToCanonicalJson());
    }

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

        using JsonDocument actualCanonical = JsonDocument.Parse(
            result.Definition.ToCanonicalJson());
        Assert.True(
            JsonElement.DeepEquals(
                testCase.GetProperty("canonical"),
                actualCanonical.RootElement));
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
