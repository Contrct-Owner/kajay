Survey q9Survey = SurveyDefinition.Parse(
    """{"title":{"default":"Survey","fr":"Sondage"},"locale":"fr-CA","pages":[{"name":"one","elements":[{"type":"radiogroup","name":"country","title":{"default":"Country","fr":"Pays"},"choices":[{"value":"ca","text":{"default":"Canada","fr":"Canada français"}}]}]}]}""")
    .Definition
    .CreateSurvey();
SurveyChoiceQuestion q9Question = (SurveyChoiceQuestion)q9Survey.GetQuestion("country")!;
var q9Locales = new List<string>();
q9Survey.LocaleChanged += (_, eventArgs) => q9Locales.Add(eventArgs.Locale);
if (q9Survey.Title != "Sondage"
    || q9Question.Title != "Pays"
    || q9Question.ChoiceItems.Single().Text != "Canada français")
{
    throw new InvalidOperationException("Installed package failed Q9 localization parity.");
}

q9Survey.SetLocale("en-US");
if (q9Survey.Title != "Survey" || !q9Locales.SequenceEqual(["en-US"]))
{
    throw new InvalidOperationException("Installed package failed Q9 locale switching.");
}

SurveyDefinitionRegistry q9Registry = SurveyDefinitionRegistry.Default.WithClass(
    new SurveyDefinitionClassRegistration(
        "packbadge",
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
                System.Text.Json.Nodes.JsonValue.Create(2.5)),
        ],
        questionFactory: context => new Q9PackQuestion(context)));
Survey q9Extended = SurveyDefinition.Parse(
    """{"locale":"fr-CA","pages":[{"name":"one","elements":[{"type":"packbadge","name":"badge","badgeText":{"default":"Badge","fr":"Insigne"}}]}]}""",
    q9Registry).Definition.CreateSurvey();
Q9PackQuestion q9Badge = (Q9PackQuestion)q9Extended.GetQuestion("badge")!;
if (q9Badge.BadgeText != "Insigne" || q9Badge.Weight != 2.5)
{
    throw new InvalidOperationException("Installed package failed Q9 extension-registry parity.");
}
