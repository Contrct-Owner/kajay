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
    """{"locale":"fr-CA","pages":[{"name":"one","elements":[{"type":"packbadge","name":"badge","badgeText":{"default":"Badge","fr":"Insigne"},"validators":[{"type":"regexvalidator","regex":"^(ab|cd)+\\d{2}$"}]}]}]}""",
    q9Registry).Definition.CreateSurvey();
Q9PackQuestion q9Badge = (Q9PackQuestion)q9Extended.GetQuestion("badge")!;
q9Badge.SetValue(KajayValue.From("abX2"));
SurveyExpression q9Date = SurveyExpression.Parse(
    "getDate('2030-01-02T03:04:05+05:30')").Expression!;
KajayValue q9Instant = q9Date.Evaluate(new ExpressionEvaluationContext(
    new DateTimeOffset(2040, 1, 1, 0, 0, 0, TimeSpan.FromHours(-8)))).Value;
if (q9Badge.BadgeText != "Insigne"
    || q9Badge.Weight != 2.5
    || q9Extended.Validation.ValidateCurrentPage().IsValid
    || q9Instant != KajayValue.From(new DateTimeOffset(2030, 1, 1, 21, 34, 5, TimeSpan.Zero)))
{
    throw new InvalidOperationException("Installed package failed Q9 extension-registry parity.");
}
