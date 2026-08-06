namespace Kajay;

internal sealed class DependencyGraph
{
    private readonly Dictionary<string, DependencyNode> _nodes = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string[]> _outgoing = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string[]> _predecessors = new(StringComparer.Ordinal);
    private bool _edgesAreCurrent;

    internal void AddNode(DependencyNode node)
    {
        ArgumentNullException.ThrowIfNull(node);
        if (!_nodes.TryAdd(node.Key, node))
        {
            throw new ArgumentException(
                $"Dependency node '{node.Key}' is already registered.",
                nameof(node));
        }

        _edgesAreCurrent = false;
    }

    internal void SetNode(DependencyNode node)
    {
        ArgumentNullException.ThrowIfNull(node);
        _nodes[node.Key] = node;
        _edgesAreCurrent = false;
    }

    internal bool RemoveNode(string key)
    {
        ArgumentNullException.ThrowIfNull(key);
        bool removed = _nodes.Remove(key);
        _edgesAreCurrent &= !removed;
        return removed;
    }

    internal DependencyPlan Plan(IReadOnlyList<ExpressionPath> changedPaths)
    {
        ArgumentNullException.ThrowIfNull(changedPaths);
        return Order(CollectAffected(changedPaths));
    }

    internal DependencyPlan PlanAll()
    {
        return Order(new HashSet<string>(_nodes.Keys, StringComparer.Ordinal));
    }

    private HashSet<string> CollectAffected(IReadOnlyList<ExpressionPath> changedPaths)
    {
        EnsureEdges();
        var affected = new HashSet<string>(StringComparer.Ordinal);
        var queue = new Queue<string>();
        foreach (ExpressionPath path in changedPaths)
        {
            AddDependents(path, affected, queue);
        }

        while (queue.TryDequeue(out string? key))
        {
            foreach (string dependent in _outgoing[key])
            {
                if (affected.Add(dependent))
                {
                    queue.Enqueue(dependent);
                }
            }
        }

        return affected;
    }

    private void AddDependents(
        ExpressionPath path,
        HashSet<string> affected,
        Queue<string> queue)
    {
        foreach (string key in SortedKeys())
        {
            DependencyNode node = _nodes[key];
            if (node.Reads.Any(pattern => pattern.Overlaps(path)) && affected.Add(key))
            {
                queue.Enqueue(key);
            }
        }
    }

    private DependencyPlan Order(HashSet<string> affected)
    {
        EnsureEdges();
        List<string> order = [];
        List<DependencyError> errors = [];
        var states = new Dictionary<string, VisitState>(StringComparer.Ordinal);
        List<string> stack = [];

        void Visit(string key)
        {
            if (states.GetValueOrDefault(key) is VisitState.Done)
            {
                return;
            }

            if (states.GetValueOrDefault(key) is VisitState.Visiting)
            {
                int start = stack.IndexOf(key);
                string[] cycle = [.. stack.Skip(start < 0 ? 0 : start), key];
                errors.Add(new DependencyError("cycle", cycle));
                return;
            }

            states[key] = VisitState.Visiting;
            stack.Add(key);
            foreach (string predecessor in PredecessorsOf(key, affected))
            {
                Visit(predecessor);
            }

            stack.RemoveAt(stack.Count - 1);
            states[key] = VisitState.Done;
            order.Add(key);
        }

        foreach (string key in SortedKeys())
        {
            if (affected.Contains(key))
            {
                Visit(key);
            }
        }

        return new DependencyPlan(order.ToArray(), errors.ToArray());
    }

    private string[] PredecessorsOf(
        string key,
        HashSet<string> affected)
    {
        return _predecessors[key]
            .Where(affected.Contains)
            .ToArray();
    }

    private void EnsureEdges()
    {
        if (_edgesAreCurrent)
        {
            return;
        }

        _outgoing.Clear();
        _predecessors.Clear();
        string[] keys = SortedKeys();
        foreach (string key in keys)
        {
            _outgoing[key] = [];
            _predecessors[key] = [];
        }

        foreach (string writerKey in keys)
        {
            if (_nodes[writerKey].Writes is not ExpressionPath written)
            {
                continue;
            }

            string[] dependents = keys
                .Where(dependent => _nodes[dependent].Reads.Any(
                    pattern => pattern.Overlaps(written)))
                .ToArray();
            _outgoing[writerKey] = dependents;
            foreach (string dependent in dependents)
            {
                _predecessors[dependent] = [.. _predecessors[dependent], writerKey];
            }
        }

        _edgesAreCurrent = true;
    }

    private string[] SortedKeys()
    {
        return _nodes.Keys.Order(StringComparer.Ordinal).ToArray();
    }

    private enum VisitState
    {
        Unvisited,
        Visiting,
        Done,
    }
}
