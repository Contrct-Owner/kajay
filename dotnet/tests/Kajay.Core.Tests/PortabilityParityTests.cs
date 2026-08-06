using System.Globalization;

namespace Kajay.Tests;

public sealed class PortabilityParityTests
{
    [Fact(DisplayName = "parity/Q9-portability")]
    public void RuntimeIsPortableAcrossLocaleCultureUtcPatternsAndExtensions()
    {
        CultureInfo originalCulture = CultureInfo.CurrentCulture;
        CultureInfo originalUiCulture = CultureInfo.CurrentUICulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("fr-FR");
            CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo("tr-TR");
            ProvePortability();
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
            CultureInfo.CurrentUICulture = originalUiCulture;
        }
    }

    private static void ProvePortability()
    {
        SurveyDefinitionRegistry registry = SurveyDefinitionRegistry.Default.WithClass(
            new SurveyDefinitionClassRegistration(
                "portable",
                parent: "text",
                properties:
                [
                    new SurveyDefinitionPropertyRegistration(
                        "marker",
                        SurveyDefinitionPropertyType.Text,
                        isLocalizable: true),
                ],
                questionFactory: context => new PortableQuestion(context)));
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(Definition(), registry);
        Survey survey = parsed.Definition.CreateSurvey();
        PortableQuestion question = Assert.IsType<PortableQuestion>(survey.GetQuestion("code"));

        Assert.Empty(parsed.Diagnostics);
        Assert.Equal("Questionnaire", survey.Title);
        Assert.Equal("Insigne", question.Marker);
        survey.SetLocale("FR-be");
        Assert.Equal("Sondage", survey.Title);
        survey.SetLocale("es-MX");
        Assert.Equal("Survey", survey.Title);
        Assert.Contains("\"FR-ca\":\"Questionnaire\"", parsed.Definition.ToCanonicalJson());

        question.SetValue(KajayValue.From("ab12"));
        Assert.True(survey.Validation.ValidateCurrentPage().IsValid);
        question.SetValue(KajayValue.From("abX2"));
        Assert.False(survey.Validation.ValidateCurrentPage().IsValid);

        SurveyExpression expression = SurveyExpression
            .Parse("getDate('2030-01-02T03:04:05+05:30')")
            .Expression!;
        ExpressionEvaluationResult result = expression.Evaluate(
            new ExpressionEvaluationContext(
                new DateTimeOffset(2040, 1, 1, 0, 0, 0, TimeSpan.FromHours(-8))));
        Assert.Equal(
            KajayValue.From(new DateTimeOffset(2030, 1, 1, 21, 34, 5, TimeSpan.Zero)),
            result.Value);
        Assert.Empty(result.Errors);
    }

    private static string Definition()
    {
        return """
            {
              "locale": "fr-CA",
              "title": { "default": "Survey", "fr": "Sondage", "FR-ca": "Questionnaire" },
              "pages": [{
                "name": "main",
                "elements": [{
                  "type": "portable",
                  "name": "code",
                  "marker": { "default": "Badge", "fr": "Insigne" },
                  "validators": [{ "type": "regexvalidator", "regex": "^(ab|cd)+\\d{2}$" }]
                }]
              }]
            }
            """;
    }

    private sealed class PortableQuestion : SurveyQuestion
    {
        private readonly SurveyQuestionFactoryContext _context;

        public PortableQuestion(SurveyQuestionFactoryContext context)
            : base(context)
        {
            _context = context;
        }

        public string Marker => _context.GetTextProperty("marker");
    }
}
