using System.Text.Json.Nodes;

namespace Kajay.Tests;

public sealed class SurveyDefinitionRegistryTests
{
    [Fact]
    public void RegistryDrivesCanonicalizationTraversalAndNativeFactory()
    {
        SurveyDefinitionRegistry registry = CreateRegistry(
            context => new BadgeQuestion(context));
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(Definition(), registry);

        Assert.Empty(parsed.Diagnostics);
        Assert.Contains("\"tenantTag\":\"blue\"", parsed.Definition.ToCanonicalJson());
        Assert.Contains("\"badgeText\":{\"default\":\"Badge\",\"fr\":\"Insigne\"}",
            parsed.Definition.ToCanonicalJson());
        Assert.Equal(
            parsed.Definition.ToCanonicalJson(),
            SurveyDefinition.Parse(parsed.Definition.ToCanonicalJson(), registry)
                .Definition.ToCanonicalJson());

        Survey survey = parsed.Definition.CreateSurvey();
        BadgeQuestion question = Assert.IsType<BadgeQuestion>(survey.GetQuestion("member"));

        Assert.Equal("Insigne", question.BadgeText);
        Assert.Equal("blue", question.TenantTag);
        Assert.Equal(1.5, question.Weight);
        Assert.True(question.State.IsVisible);
        question.SetValue(KajayValue.From("gold"));
        Assert.Equal(KajayValue.From("gold"), survey.Data["member"]);

        survey.SetLocale("en-US");
        Assert.Equal("Badge", question.BadgeText);
    }

    [Fact]
    public void RegistriesAreIsolatedAndSupportIndependentFactoryImplementations()
    {
        SurveyDefinitionRegistry first = CreateRegistry(context => new BadgeQuestion(context));
        SurveyDefinitionRegistry second = CreateRegistry(
            context => new AlternateBadgeQuestion(context));

        SurveyQuestion firstQuestion = SurveyDefinition.Parse(Definition(), first)
            .Definition.CreateSurvey().GetQuestion("member")!;
        SurveyQuestion secondQuestion = SurveyDefinition.Parse(Definition(), second)
            .Definition.CreateSurvey().GetQuestion("member")!;
        SurveyDefinitionParseResult unextended = SurveyDefinition.Parse(Definition());

        Assert.IsType<BadgeQuestion>(firstQuestion);
        Assert.IsType<AlternateBadgeQuestion>(secondQuestion);
        Assert.Contains(
            unextended.Diagnostics,
            diagnostic => diagnostic.Code == "unknown-element-type");
        Assert.Empty(unextended.Definition.CreateSurvey().Questions);
    }

    [Fact]
    public void InvalidRegistrationsFailBeforeChangingTheSourceRegistry()
    {
        SurveyDefinitionRegistry source = SurveyDefinitionRegistry.Default;
        SurveyDefinitionClassRegistration invalid = new(
            "host-page",
            parent: "page",
            questionFactory: context => new BadgeQuestion(context));

        Assert.Throws<ArgumentException>(() => source.WithClass(invalid));
        Assert.Throws<ArgumentException>(() => source.WithClass(
            new SurveyDefinitionClassRegistration("orphan", parent: "missing")));

        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(Definition(), source);
        Assert.Contains(parsed.Diagnostics, diagnostic => diagnostic.Code == "unknown-element-type");
    }

    private static SurveyDefinitionRegistry CreateRegistry(SurveyQuestionFactory factory)
    {
        return SurveyDefinitionRegistry.Default
            .WithProperty(
                "question",
                new SurveyDefinitionPropertyRegistration(
                    "tenantTag",
                    SurveyDefinitionPropertyType.Text))
            .WithClass(new SurveyDefinitionClassRegistration(
                "hostpanel",
                parent: "pageelement",
                childCollections:
                [
                    new SurveyDefinitionChildCollectionRegistration(
                        "content",
                        "pageelement"),
                ]))
            .WithClass(new SurveyDefinitionClassRegistration(
                "badge",
                parent: "text",
                properties:
                [
                    new SurveyDefinitionPropertyRegistration(
                        "badgeText",
                        SurveyDefinitionPropertyType.Text,
                        isLocalizable: true),
                    new SurveyDefinitionPropertyRegistration(
                        "weight",
                        SurveyDefinitionPropertyType.Number,
                        JsonValue.Create(1.5)),
                ],
                questionFactory: factory));
    }

    private static string Definition()
    {
        return """
            {
              "locale": "fr-CA",
              "pages": [{
                "name": "main",
                "elements": [{
                  "type": "hostpanel",
                  "name": "holder",
                  "content": [{
                    "type": "badge",
                    "name": "member",
                    "tenantTag": "blue",
                    "badgeText": { "default": "Badge", "fr": "Insigne" }
                  }]
                }]
              }]
            }
            """;
    }

    private sealed class BadgeQuestion : SurveyQuestion
    {
        private readonly SurveyQuestionFactoryContext _context;

        public BadgeQuestion(SurveyQuestionFactoryContext context)
            : base(context)
        {
            _context = context;
        }

        public string BadgeText => _context.GetTextProperty("badgeText");

        public string TenantTag => _context.GetTextProperty("tenantTag");

        public double Weight => _context.GetProperty("weight")?.GetValue<double>() ?? 0;
    }

    private sealed class AlternateBadgeQuestion : SurveyQuestion
    {
        public AlternateBadgeQuestion(SurveyQuestionFactoryContext context)
            : base(context)
        {
        }
    }
}
