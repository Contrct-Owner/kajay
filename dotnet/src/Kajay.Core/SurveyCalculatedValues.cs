namespace Kajay;

internal sealed class SurveyCalculatedValues
{
    private readonly Survey _survey;
    private readonly DependencyGraph _graph = new();
    private readonly Dictionary<string, SurveyRuntimeCalculatedValue> _rules =
        new(StringComparer.Ordinal);
    private readonly Dictionary<string, KajayValue> _values = new(StringComparer.Ordinal);

    internal SurveyCalculatedValues(
        Survey survey,
        IReadOnlyList<SurveyRuntimeCalculatedValue> definitions)
    {
        _survey = survey;
        for (int index = 0; index < definitions.Count; index += 1)
        {
            SurveyRuntimeCalculatedValue definition = definitions[index];
            if (definition.Name.Length == 0 || definition.Expression is null)
            {
                continue;
            }

            string key = $"calculated:{index:D8}:{definition.Name}";
            _rules.Add(key, definition);
            _graph.AddNode(DependencyNode.FromExpression(
                key,
                definition.Expression,
                ExpressionPath.FromName(definition.Name)));
        }
    }

    internal bool TryGetValue(string name, out KajayValue value)
    {
        return _values.TryGetValue(name, out value);
    }

    internal void CopyIncludedTo(IDictionary<string, KajayValue> destination)
    {
        foreach (SurveyRuntimeCalculatedValue definition in _rules.Values)
        {
            if (definition.IncludeIntoResult
                && _values.TryGetValue(definition.Name, out KajayValue value))
            {
                destination[definition.Name] = value;
            }
        }
    }

    internal void SettleAll()
    {
        Settle(_graph.PlanAll(), null);
    }

    internal IReadOnlyList<ExpressionPath> SettleAll(
        ICollection<SurveyValueChangedEventArgs> changes)
    {
        return Settle(_graph.PlanAll(), changes);
    }

    internal IReadOnlyList<ExpressionPath> Recalculate(
        IReadOnlyList<ExpressionPath> changedPaths,
        ICollection<SurveyValueChangedEventArgs> changes)
    {
        return Settle(_graph.Plan(changedPaths), changes);
    }

    private List<ExpressionPath> Settle(
        DependencyPlan plan,
        ICollection<SurveyValueChangedEventArgs>? changes)
    {
        HashSet<string> cyclicNodes = plan.Errors
            .Where(error => string.Equals(error.Code, "cycle", StringComparison.Ordinal))
            .SelectMany(error => error.Nodes)
            .ToHashSet(StringComparer.Ordinal);
        List<ExpressionPath> writes = [];

        foreach (string key in plan.Order)
        {
            if (cyclicNodes.Contains(key))
            {
                continue;
            }

            SurveyRuntimeCalculatedValue rule = _rules[key];
            ExpressionEvaluationResult evaluation = rule.Expression!.Evaluate(
                _survey.CreateExpressionContext());
            _survey.RecordLogicErrors(evaluation.Errors);
            if (evaluation.Errors.Count > 0)
            {
                continue;
            }

            bool hadPrevious = _values.TryGetValue(rule.Name, out KajayValue previousValue);
            if (hadPrevious && previousValue == evaluation.Value)
            {
                continue;
            }

            _values[rule.Name] = evaluation.Value;
            writes.Add(ExpressionPath.FromName(rule.Name));
            if (changes is not null && rule.IncludeIntoResult)
            {
                changes.Add(new SurveyValueChangedEventArgs(
                    rule.Name,
                    hadPrevious ? previousValue : KajayValue.Absent,
                    evaluation.Value));
            }
        }

        return writes;
    }
}
