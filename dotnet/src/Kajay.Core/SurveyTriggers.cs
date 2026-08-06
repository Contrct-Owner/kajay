namespace Kajay;

internal sealed class SurveyTriggers
{
    private readonly Survey _survey;
    private readonly DependencyGraph _graph = new();
    private readonly Dictionary<string, SurveyTriggerState> _rules =
        new(StringComparer.Ordinal);

    internal SurveyTriggers(
        Survey survey,
        IReadOnlyList<SurveyRuntimeTrigger> definitions)
    {
        _survey = survey;
        for (int index = 0; index < definitions.Count; index += 1)
        {
            SurveyRuntimeTrigger definition = definitions[index];
            string key = $"trigger:{index:D8}:{definition.Kind}";
            _rules.Add(key, new SurveyTriggerState(definition));
            _graph.AddNode(DependencyNode.FromExpression(
                key,
                definition.Condition,
                WrittenPath(definition)));
        }
    }

    internal void Establish()
    {
        _ = Settle(_graph.PlanAll(), null);
    }

    internal IReadOnlyList<ExpressionPath> SettleAll(
        ICollection<SurveyValueChangedEventArgs> changes)
    {
        return Settle(_graph.PlanAll(), changes);
    }

    internal IReadOnlyList<ExpressionPath> Settle(
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

            SurveyTriggerState state = _rules[key];
            ExpressionEvaluationResult evaluation = state.Definition.Condition.Evaluate(
                _survey.CreateExpressionContext());
            if (evaluation.Errors.Count > 0)
            {
                continue;
            }

            bool isTrue = KajayValueSemantics.IsTruthy(evaluation.Value);
            bool becameTrue = state.IsEstablished && isTrue && !state.WasTrue;
            state.IsEstablished = true;
            state.WasTrue = isTrue;
            if (becameTrue && changes is not null)
            {
                Perform(state.Definition, changes, writes);
            }
        }

        return writes;
    }

    private void Perform(
        SurveyRuntimeTrigger trigger,
        ICollection<SurveyValueChangedEventArgs> changes,
        ICollection<ExpressionPath> writes)
    {
        switch (trigger.Kind)
        {
            case SurveyTriggerKind.Complete:
                _survey.Complete();
                break;
            case SurveyTriggerKind.Skip:
                _survey.GoToPageOrQuestion(trigger.GoToName);
                break;
            case SurveyTriggerKind.SetValue:
                Write(trigger.SetToName, trigger.SetValue, changes, writes);
                break;
            case SurveyTriggerKind.CopyValue:
                Write(trigger.SetToName, _survey.GetValue(trigger.FromName), changes, writes);
                break;
            case SurveyTriggerKind.RunExpression:
                RunExpression(trigger, changes, writes);
                break;
        }
    }

    private void RunExpression(
        SurveyRuntimeTrigger trigger,
        ICollection<SurveyValueChangedEventArgs> changes,
        ICollection<ExpressionPath> writes)
    {
        if (trigger.RunExpression is null)
        {
            return;
        }

        ExpressionEvaluationResult evaluation = trigger.RunExpression.Evaluate(
            _survey.CreateExpressionContext());
        if (evaluation.Errors.Count == 0)
        {
            Write(trigger.SetToName, evaluation.Value, changes, writes);
        }
    }

    private void Write(
        string name,
        KajayValue value,
        ICollection<SurveyValueChangedEventArgs> changes,
        ICollection<ExpressionPath> writes)
    {
        if (name.Length > 0 && _survey.WriteValue(name, value, changes))
        {
            writes.Add(ExpressionPath.FromName(name));
        }
    }

    private static ExpressionPath? WrittenPath(SurveyRuntimeTrigger trigger)
    {
        return trigger.Kind is SurveyTriggerKind.SetValue
            or SurveyTriggerKind.CopyValue
            or SurveyTriggerKind.RunExpression
            && trigger.SetToName.Length > 0
                ? ExpressionPath.FromName(trigger.SetToName)
                : null;
    }
}
