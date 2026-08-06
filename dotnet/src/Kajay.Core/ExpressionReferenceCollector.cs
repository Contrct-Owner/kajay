namespace Kajay;

internal static class ExpressionReferenceCollector
{
    internal static IReadOnlyList<ExpressionPath> Collect(ExpressionNode root)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        List<ExpressionPath> references = [];
        Visit(root, seen, references);
        return references.ToArray();
    }

    private static void Visit(
        ExpressionNode node,
        ISet<string> seen,
        ICollection<ExpressionPath> references)
    {
        if (node is ExpressionNode.Reference reference)
        {
            string formatted = reference.Path.Format();
            if (seen.Add(formatted))
            {
                references.Add(reference.Path);
            }

            return;
        }

        foreach (ExpressionNode child in Children(node))
        {
            Visit(child, seen, references);
        }
    }

    private static IEnumerable<ExpressionNode> Children(ExpressionNode node)
    {
        return node switch
        {
            ExpressionNode.Array array => array.Items,
            ExpressionNode.Call call => call.Arguments,
            ExpressionNode.Unary unary => [unary.Operand],
            ExpressionNode.Postfix postfix => [postfix.Operand],
            ExpressionNode.Binary binary => [binary.Left, binary.Right],
            _ => [],
        };
    }
}
