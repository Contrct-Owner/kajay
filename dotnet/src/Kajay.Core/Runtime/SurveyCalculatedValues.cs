namespace Kajay.Runtime;

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
            _graph.AddNode(DependencyNode.FromExpression(key, definition.Expression, definition.Path));
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
            // A rule with an owner has already written into that answer, so it is in the
            // response by the only route answers ever take.
            //
            // A value with nothing in it is *not* in the response, which is a fix rather than
            // a nicety: an untouched survey used to answer `{ "total": absent }`, an entry
            // TypeScript has never had and one that says a value was recorded when none was.
            // The rule is still recorded and still readable — only the response is filtered.
            if (definition.IncludeIntoResult
                && definition.Owner is null
                && _values.TryGetValue(definition.Name, out KajayValue value)
                && value.Kind != KajayValueKind.Absent)
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

            if (Store(rule, evaluation.Value, changes))
            {
                writes.Add(rule.Path);
            }
        }

        return writes;
    }

    /// <summary>Records a settled value where it belongs, reporting whether it moved.</summary>
    private bool Store(
        SurveyRuntimeCalculatedValue rule,
        KajayValue value,
        ICollection<SurveyValueChangedEventArgs>? changes)
    {
        if (rule.Owner is not null)
        {
            return StoreInsideAnswer(rule, value, changes);
        }

        bool hadPrevious = _values.TryGetValue(rule.Name, out KajayValue previousValue);
        if (hadPrevious && previousValue == value)
        {
            return false;
        }

        _values[rule.Name] = value;
        if (changes is not null && rule.IncludeIntoResult)
        {
            changes.Add(new SurveyValueChangedEventArgs(
                rule.Name,
                hadPrevious ? previousValue : KajayValue.Absent,
                value));
        }

        return true;
    }

    /// <summary>Writes a computed blank into its sentence's answer, as any blank is written.</summary>
    /// <remarks>
    /// Through the survey's own answer write, not a store of this class's own: the value is an
    /// answer, so it is announced, restored and read exactly as the blanks beside it are.
    /// </remarks>
    private bool StoreInsideAnswer(
        SurveyRuntimeCalculatedValue rule,
        KajayValue value,
        ICollection<SurveyValueChangedEventArgs>? changes)
    {
        KajayValue owner = _survey.GetValue(rule.Owner!);
        Dictionary<string, KajayValue> next = owner.Kind == KajayValueKind.Map
            ? new Dictionary<string, KajayValue>(owner.GetObject(), StringComparer.Ordinal)
            : new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        bool hadPrevious = next.TryGetValue(rule.Name, out KajayValue previousValue);
        if (value.Kind == KajayValueKind.Absent)
        {
            if (!hadPrevious)
            {
                return false;
            }

            _ = next.Remove(rule.Name);
        }
        else if (hadPrevious && previousValue == value)
        {
            return false;
        }
        else
        {
            next[rule.Name] = value;
        }

        // An object with nothing left in it becomes absent, exactly as a blank written by hand
        // does: an empty map is not empty by any test the engine applies, so a required
        // sentence would be satisfied by one nobody filled in.
        return _survey.WriteValue(
            rule.Owner!,
            next.Count > 0 ? KajayValue.FromObject(next) : KajayValue.Absent,
            changes ?? []);
    }
}
