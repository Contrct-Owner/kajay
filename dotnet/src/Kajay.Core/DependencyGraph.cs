namespace Kajay;

internal sealed class DependencyGraph
{
    private readonly Dictionary<string, DependencyNode> _nodes = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string[]> _outgoing = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string[]> _predecessors = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string[]> _readersByRoot = new(StringComparer.Ordinal);
    private string[] _rootAgnosticReaders = [];
    private string[] _sortedKeys = [];
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
        foreach (string key in CandidateReaders(path))
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
            foreach (string predecessor in _predecessors[key])
            {
                if (affected.Contains(predecessor))
                {
                    Visit(predecessor);
                }
            }

            stack.RemoveAt(stack.Count - 1);
            states[key] = VisitState.Done;
            order.Add(key);
        }

        foreach (string key in _sortedKeys)
        {
            if (affected.Contains(key))
            {
                Visit(key);
            }
        }

        return new DependencyPlan(order.ToArray(), errors.ToArray());
    }

    private void EnsureEdges()
    {
        if (_edgesAreCurrent)
        {
            return;
        }

        _outgoing.Clear();
        _predecessors.Clear();
        _readersByRoot.Clear();
        _sortedKeys = _nodes.Keys.Order(StringComparer.Ordinal).ToArray();
        var outgoing = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var predecessors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (string key in _sortedKeys)
        {
            outgoing[key] = [];
            predecessors[key] = [];
        }

        BuildReaderIndex();
        foreach (string writerKey in _sortedKeys)
        {
            if (_nodes[writerKey].Writes is not ExpressionPath written)
            {
                continue;
            }

            foreach (string dependent in CandidateReaders(written))
            {
                if (_nodes[dependent].Reads.Any(pattern => pattern.Overlaps(written)))
                {
                    outgoing[writerKey].Add(dependent);
                    predecessors[dependent].Add(writerKey);
                }
            }
        }

        foreach (string key in _sortedKeys)
        {
            _outgoing[key] = outgoing[key].ToArray();
            _predecessors[key] = predecessors[key].ToArray();
        }

        _edgesAreCurrent = true;
    }

    private void BuildReaderIndex()
    {
        var readersByRoot = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        List<string> rootAgnostic = [];
        foreach (string key in _sortedKeys)
        {
            string?[] roots = _nodes[key].Reads
                .Select(pattern => pattern.RootName)
                .Distinct(StringComparer.Ordinal)
                .ToArray();
            if (roots.Any(root => root is null))
            {
                rootAgnostic.Add(key);
            }
            foreach (string root in roots.OfType<string>())
            {
                if (!readersByRoot.TryGetValue(root, out List<string>? readers))
                {
                    readers = [];
                    readersByRoot.Add(root, readers);
                }

                readers.Add(key);
            }
        }

        foreach ((string root, List<string> readers) in readersByRoot)
        {
            _readersByRoot[root] = readers.ToArray();
        }
        _rootAgnosticReaders = rootAgnostic.ToArray();
    }

    private IEnumerable<string> CandidateReaders(ExpressionPath path)
    {
        string? root = path.Segments.Count > 0 && !path.Segments[0].IsIndex
            ? path.Segments[0].Name
            : null;
        if (root is null)
        {
            return _sortedKeys;
        }

        IEnumerable<string> rooted = _readersByRoot.TryGetValue(root, out string[]? readers)
            ? readers
            : Array.Empty<string>();
        return rooted.Concat(_rootAgnosticReaders).Distinct(StringComparer.Ordinal);
    }

    private enum VisitState
    {
        Unvisited,
        Visiting,
        Done,
    }
}
