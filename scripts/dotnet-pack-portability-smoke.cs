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
