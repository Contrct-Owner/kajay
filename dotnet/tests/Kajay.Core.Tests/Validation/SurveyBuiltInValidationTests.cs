namespace Kajay.Core.Tests;

public sealed class SurveyBuiltInValidationTests
{
    [Fact]
    public void RequiredAndBuiltInValidatorsReportEveryReachableFailureInOrder()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "pages":[{
                "name":"one",
                "elements":[
                  {"type":"text","name":"required","requiredIf":"{must} = true","requiredErrorText":"Needed"},
                  {"type":"text","name":"numeric","valueName":"number","validators":[{"type":"numericvalidator","minValue":1,"maxValue":10}]},
                  {"type":"text","name":"plain","validators":[{"type":"textvalidator","minLength":3,"maxLength":8,"allowDigits":false}]},
                  {"type":"text","name":"pattern","validators":[{"type":"regexvalidator","regex":"^KJ-\\d+$"}]},
                  {"type":"text","name":"email","validators":[{"type":"emailvalidator"}]},
                  {"type":"text","name":"expression","validators":[{"type":"expressionvalidator","expression":"{agree} = true","text":"Agree first"}]},
                  {"type":"tagbox","name":"choices","choices":["a","b","c"],"validators":[{"type":"answercountvalidator","minCount":2,"maxCount":3}]},
                  {"type":"text","name":"hiddenRequired","isRequired":true,"visibleIf":"false"}
                ]
              }]
            }
            """)
            .Definition
            .CreateSurvey();
        survey.SetValue("must", KajayValue.From(true));
        survey.SetValue("number", KajayValue.From("not-a-number"));
        survey.SetValue("plain", KajayValue.From("a1"));
        survey.SetValue("pattern", KajayValue.From("wrong"));
        survey.SetValue("email", KajayValue.From("not-an-email"));
        survey.SetValue("expression", KajayValue.From("answered"));
        survey.SetValue("agree", KajayValue.From(false));
        survey.SetValue("choices", KajayValue.FromArray([KajayValue.From("a")]));

        SurveyValidationResult failed = survey.Validation.ValidateCurrentPage();

        Assert.False(failed.IsValid);
        Assert.Equal(
            ["required", "numericvalidator", "textvalidator", "regexvalidator",
                "emailvalidator", "expressionvalidator", "answercountvalidator"],
            failed.Errors.Select(error => error.Kind));
        Assert.Equal("Needed", failed.Errors[0].Message);
        Assert.Equal("Agree first", failed.Errors[5].Message);
        Assert.DoesNotContain(failed.Errors, error => error.Name == "hiddenRequired");

        survey.SetValue("required", KajayValue.From("present"));
        survey.SetValue("number", KajayValue.From(5));
        survey.SetValue("plain", KajayValue.From("letters"));
        survey.SetValue("pattern", KajayValue.From("KJ-42"));
        survey.SetValue("email", KajayValue.From("person@example.com"));
        survey.SetValue("agree", KajayValue.From(true));
        survey.SetValue(
            "choices",
            KajayValue.FromArray([KajayValue.From("a"), KajayValue.From("b")]));

        SurveyValidationResult passed = survey.Validation.ValidateCurrentPage();
        Assert.True(passed.IsValid);
        Assert.Empty(passed.Errors);
    }
}
