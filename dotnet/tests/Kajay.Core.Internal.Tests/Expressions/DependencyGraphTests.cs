namespace Kajay.Core.Internal.Tests.Expressions;

public sealed class DependencyGraphTests
{
    [Fact]
    public void ChangedPathsExpandTransitivelyAndOrderDependenciesFirst()
    {
        var graph = new DependencyGraph();
        graph.AddNode(Node("tax", ["subtotal"], "tax"));
        graph.AddNode(Node("subtotal", ["price", "quantity"], "subtotal"));
        graph.AddNode(Node("total", ["subtotal", "tax"], "total"));
        graph.AddNode(Node("unrelated", ["other"], "unrelated"));

        DependencyPlan plan = graph.Plan([Path("price")]);

        Assert.Equal(["subtotal", "tax", "total"], plan.Order);
        Assert.Empty(plan.Errors);
    }

    [Fact]
    public void PrefixOverlapInvalidatesParentsAndChildren()
    {
        var graph = new DependencyGraph();
        graph.AddNode(Node("reads-child", ["panel[0].question"]));
        graph.AddNode(Node("reads-parent", ["panel"]));

        Assert.Equal(
            ["reads-child", "reads-parent"],
            graph.Plan([Path("panel")]).Order);
        Assert.Equal(
            ["reads-child", "reads-parent"],
            graph.Plan([Path("panel[0].question")]).Order);
    }

    [Fact]
    public void GeneralizedIndicesMatchEveryConcreteRowOnly()
    {
        var graph = new DependencyGraph();
        graph.AddNode(new DependencyNode(
            "row-total",
            [DependencyPattern.GeneralizeIndices(Path("rows[0].amount"))]));

        Assert.Equal(["row-total"], graph.Plan([Path("rows[4].amount")]).Order);
        Assert.Empty(graph.Plan([Path("rows.amount")]).Order);
    }

    [Fact]
    public void CyclesReportTheStableClosingPath()
    {
        var graph = new DependencyGraph();
        graph.AddNode(Node("a", ["b"], "a"));
        graph.AddNode(Node("b", ["a"], "b"));

        DependencyPlan plan = graph.PlanAll();

        DependencyError error = Assert.Single(plan.Errors);
        Assert.Equal("cycle", error.Code);
        Assert.Equal(["a", "b", "a"], error.Nodes);
    }

    [Fact]
    public void DuplicateKeysAreRejectedAndRegistrationsCanBeReplacedOrRemoved()
    {
        var graph = new DependencyGraph();
        graph.AddNode(Node("rule", ["first"]));

        Assert.Throws<ArgumentException>(() => graph.AddNode(Node("rule", ["second"])));
        graph.SetNode(Node("rule", ["second"]));
        Assert.Empty(graph.Plan([Path("first")]).Order);
        Assert.Equal(["rule"], graph.Plan([Path("second")]).Order);
        Assert.True(graph.RemoveNode("rule"));
        Assert.False(graph.RemoveNode("rule"));
    }

    private static DependencyNode Node(
        string key,
        IReadOnlyList<string> reads,
        string? writes = null)
    {
        return new DependencyNode(
            key,
            reads.Select(path => DependencyPattern.Exact(Path(path))).ToArray(),
            writes is null ? null : Path(writes));
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
