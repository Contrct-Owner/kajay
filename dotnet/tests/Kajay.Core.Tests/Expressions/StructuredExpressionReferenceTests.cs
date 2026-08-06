namespace Kajay.Core.Tests;

public sealed class StructuredExpressionReferenceTests
{
    [Fact]
    public void ReferencesAreStructuredResolvedAndDeduplicatedInSourceOrder()
    {
        ExpressionParseResult parsed = SurveyExpression.Parse(
            "{panel[1].question} + {panel[1].question} + {other}");
        SurveyExpression expression = Assert.IsType<SurveyExpression>(parsed.Expression);
        KajayValue panel = KajayValue.FromArray(
        [
            KajayValue.FromObject([]),
            KajayValue.FromObject(
            [
                new KeyValuePair<string, KajayValue>("question", KajayValue.From(40)),
            ]),
        ]);
        ExpressionEvaluationContext context = new(
            DateTimeOffset.UnixEpoch,
            [
                new KeyValuePair<string, KajayValue>("panel", panel),
                new KeyValuePair<string, KajayValue>("other", KajayValue.From(2)),
            ]);

        ExpressionEvaluationResult evaluated = expression.Evaluate(context);

        Assert.Empty(parsed.Errors);
        Assert.Equal(["panel[1].question", "other"], expression.ReferencedValuePaths);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(KajayValue.From(82), evaluated.Value);
    }

    [Theory]
    [InlineData("{}", "empty-reference")]
    [InlineData("{rows[one]}", "invalid-reference-index")]
    [InlineData("{rows[1}", "invalid-reference-index")]
    public void InvalidReferencePathsProduceStableErrors(string source, string expectedCode)
    {
        ExpressionParseResult parsed = SurveyExpression.Parse(source);

        Assert.Null(parsed.Expression);
        Assert.Contains(parsed.Errors, error => error.Code == expectedCode);
    }

    [Fact]
    public void MissingOrMismatchedNestedSegmentsEvaluateAsAbsent()
    {
        ExpressionParseResult parsed = SurveyExpression.Parse("{panel[3].question}");
        ExpressionEvaluationContext context = new(
            DateTimeOffset.UnixEpoch,
            [
                new KeyValuePair<string, KajayValue>(
                    "panel",
                    KajayValue.FromArray([KajayValue.Null])),
            ]);

        ExpressionEvaluationResult evaluated = parsed.Expression!.Evaluate(context);

        Assert.Equal(KajayValue.Absent, evaluated.Value);
        Assert.Empty(evaluated.Errors);
    }
}
