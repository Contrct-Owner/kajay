using System.Text.Json;

namespace Kajay.Tests;

public sealed class SurveyLocalizationTests
{
    [Fact]
    public void AuthoredTextResolvesExactParentAndDefaultWithoutChangingDefinition()
    {
        const string json = """
            {
              "title": { "default": "Survey", "fr": "Sondage", "FR-ca": "Questionnaire" },
              "description": { "default": "Default description" },
              "locale": "fr-CA",
              "pages": [{
                "name": "main",
                "title": { "default": "Page", "fr": "Page française" },
                "elements": [{
                  "type": "radiogroup",
                  "name": "country",
                  "title": { "default": "Country", "fr": "Pays" },
                  "description": { "default": "Choose", "fr-CA": "Choisissez" },
                  "isRequired": true,
                  "requiredErrorText": { "default": "Required", "fr": "Obligatoire" },
                  "choices": [{
                    "value": "ca",
                    "text": { "default": "Canada", "fr": "Canada français" }
                  }]
                }]
              }]
            }
            """;
        SurveyDefinition definition = SurveyDefinition.Parse(json).Definition;
        string canonical = definition.ToCanonicalJson();
        Survey survey = definition.CreateSurvey();
        SurveyChoiceQuestion question = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("country"));

        Assert.Equal("Questionnaire", survey.Title);
        Assert.Equal("Default description", survey.Description);
        Assert.Equal("Page française", survey.CurrentPageTitle);
        Assert.Equal("Pays", question.Title);
        Assert.Equal("Choisissez", question.Description);
        Assert.Equal("Obligatoire", question.RequiredMessage);
        Assert.Equal("Canada français", Assert.Single(question.ChoiceItems).Text);

        survey.SetLocale("es-MX");

        Assert.Equal("Survey", survey.Title);
        Assert.Equal("Country", question.Title);
        Assert.Equal("Canada", Assert.Single(question.ChoiceItems).Text);
        Assert.Equal(canonical, definition.ToCanonicalJson());
        using JsonDocument roundTrip = JsonDocument.Parse(canonical);
        Assert.Equal(
            "Questionnaire",
            roundTrip.RootElement.GetProperty("title").GetProperty("FR-ca").GetString());
    }

    [Fact]
    public void LocaleChangesAreAsciiCaseInsensitiveAndAnnounceRealChangesOnly()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "locale": "en-US",
              "pages": [{ "name": "main", "elements": [{ "type": "text", "name": "name" }] }]
            }
            """).Definition.CreateSurvey();
        var observed = new List<string>();
        survey.LocaleChanged += (_, eventArgs) => observed.Add(eventArgs.Locale);

        survey.SetLocale("EN-us");
        survey.SetLocale("fr-CA");

        Assert.Equal("fr-CA", survey.Locale);
        Assert.Equal(["fr-CA"], observed);
    }
}
