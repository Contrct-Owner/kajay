namespace Kajay.Core.Tests;

public sealed class ExpressionParityProofTests
{
    [Fact(DisplayName = "parity/Q4-expressions")]
    public void ParsedReferencesDriveEvaluationAndDependencyPlanning()
    {
        SurveyExpression subtotal = Parse("{price} * {quantity}");
        ExpressionEvaluationResult evaluated = subtotal.Evaluate(
            new ExpressionEvaluationContext(
                DateTimeOffset.UnixEpoch,
                [
                    new KeyValuePair<string, KajayValue>("price", KajayValue.From(12.5)),
                    new KeyValuePair<string, KajayValue>("quantity", KajayValue.From(4)),
                ]));
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "calculatedValues":[
                {"name":"subtotal","expression":"{price} * {quantity}"},
                {"name":"tax","expression":"{subtotal} * 0.2"},
                {"name":"total","expression":"{subtotal} + {tax}"}
              ],
              "pages":[{"name":"only"}]
            }
            """).Definition.CreateSurvey();

        survey.SetValue("price", KajayValue.From(12.5));
        survey.SetValue("quantity", KajayValue.From(4));

        Assert.Equal(["price", "quantity"], subtotal.ReferencedValuePaths);
        Assert.Equal(KajayValue.From(50), evaluated.Value);
        Assert.Empty(evaluated.Errors);
        AssertCalculatedValue(survey, "subtotal", 50);
        AssertCalculatedValue(survey, "tax", 10);
        AssertCalculatedValue(survey, "total", 60);

        Survey cyclic = SurveyDefinition.Parse(
            """
            {
              "calculatedValues":[
                {"name":"a","expression":"{b}"},
                {"name":"b","expression":"{a}"},
                {"name":"independent","expression":"40 + 2"}
              ]
            }
            """).Definition.CreateSurvey();
        Assert.False(cyclic.TryGetCalculatedValue("a", out _));
        Assert.False(cyclic.TryGetCalculatedValue("b", out _));
        AssertCalculatedValue(cyclic, "independent", 42);
    }

    private static SurveyExpression Parse(string source)
    {
        ExpressionParseResult result = SurveyExpression.Parse(source);
        Assert.Empty(result.Errors);
        return Assert.IsType<SurveyExpression>(result.Expression);
    }

    private static void AssertCalculatedValue(Survey survey, string name, double expected)
    {
        Assert.True(survey.TryGetCalculatedValue(name, out KajayValue actual));
        Assert.Equal(KajayValue.From(expected), actual);
    }
}
