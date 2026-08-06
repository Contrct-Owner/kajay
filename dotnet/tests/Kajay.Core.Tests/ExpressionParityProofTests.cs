namespace Kajay.Core.Tests;

public sealed class ExpressionParityProofTests
{
    [Fact(DisplayName = "parity/Q4-expressions")]
    public void ParsedReferencesDriveEvaluationAndDependencyPlanning()
    {
        SurveyExpression subtotal = Parse("{price} * {quantity}");
        SurveyExpression tax = Parse("{subtotal} * 0.2");
        SurveyExpression total = Parse("{subtotal} + {tax}");
        var graph = new DependencyGraph();
        graph.AddNode(DependencyNode.FromExpression("subtotal", subtotal, Path("subtotal")));
        graph.AddNode(DependencyNode.FromExpression("tax", tax, Path("tax")));
        graph.AddNode(DependencyNode.FromExpression("total", total, Path("total")));

        DependencyPlan plan = graph.Plan([Path("price")]);
        ExpressionEvaluationResult evaluated = subtotal.Evaluate(
            new ExpressionEvaluationContext(
                DateTimeOffset.UnixEpoch,
                [
                    new KeyValuePair<string, KajayValue>("price", KajayValue.From(12.5)),
                    new KeyValuePair<string, KajayValue>("quantity", KajayValue.From(4)),
                ]));

        Assert.Equal(["price", "quantity"], subtotal.ReferencedValuePaths);
        Assert.Equal(KajayValue.From(50), evaluated.Value);
        Assert.Empty(evaluated.Errors);
        Assert.Equal(["subtotal", "tax", "total"], plan.Order);
        Assert.Empty(plan.Errors);

        var cyclic = new DependencyGraph();
        cyclic.AddNode(DependencyNode.FromExpression("a", Parse("{b}"), Path("a")));
        cyclic.AddNode(DependencyNode.FromExpression("b", Parse("{a}"), Path("b")));
        Assert.Equal(["a", "b", "a"], Assert.Single(cyclic.PlanAll().Errors).Nodes);
    }

    private static SurveyExpression Parse(string source)
    {
        ExpressionParseResult result = SurveyExpression.Parse(source);
        Assert.Empty(result.Errors);
        return Assert.IsType<SurveyExpression>(result.Expression);
    }

    private static ExpressionPath Path(string source)
    {
        List<ExpressionError> errors = [];
        ExpressionPath path = ExpressionPath.Parse(
            source,
            new TextSpan(0, source.Length),
            errors);
        Assert.Empty(errors);
        return path;
    }
}
