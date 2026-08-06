namespace Kajay;

internal sealed class SurveyConditions
{
    private readonly Survey _survey;
    private readonly DependencyGraph _graph = new();
    private readonly Dictionary<string, SurveyConditionalState> _states =
        new(StringComparer.Ordinal);
    private readonly Dictionary<string, SurveyConditionRule> _rules = new(StringComparer.Ordinal);
    private readonly Dictionary<int, string> _pageKeys = [];
    private readonly Dictionary<string, string> _questionKeys = new(StringComparer.Ordinal);

    internal SurveyConditions(Survey survey, SurveyRuntimeDefinition definition)
    {
        _survey = survey;
        foreach (SurveyRuntimeCondition condition in definition.Conditions)
        {
            var state = new SurveyConditionalState(condition);
            _states.Add(condition.Key, state);
            if (condition.ElementKind == SurveyElementKind.Page)
            {
                _pageKeys.Add(condition.PageIndex, condition.Key);
            }
            else if (condition.ElementKind == SurveyElementKind.Question)
            {
                _questionKeys.TryAdd(condition.Name, condition.Key);
            }

            AddRule(condition, SurveyConditionKind.Visible, condition.VisibleIf);
            AddRule(condition, SurveyConditionKind.Enabled, condition.EnableIf);
            AddRule(condition, SurveyConditionKind.Required, condition.RequiredIf);
        }
    }

    internal void Establish()
    {
        Settle(_graph.PlanAll(), null);
    }

    internal void Establish(ICollection<SurveyElementStateChangedEventArgs> changes)
    {
        Settle(_graph.PlanAll(), changes);
    }

    internal void Settle(
        IReadOnlyList<ExpressionPath> changedPaths,
        ICollection<SurveyElementStateChangedEventArgs> changes)
    {
        Settle(_graph.Plan(changedPaths), changes);
    }

    internal int[] GetVisiblePageIndexes()
    {
        return _pageKeys
            .Where(entry => _states[entry.Value].IsVisible)
            .Select(entry => entry.Key)
            .Order()
            .ToArray();
    }

    internal bool IsPageVisible(int pageIndex)
    {
        return _pageKeys.TryGetValue(pageIndex, out string? key)
            && _states[key].IsVisible;
    }

    internal bool TryGetQuestionState(
        string name,
        out SurveyQuestionState questionState)
    {
        if (!_questionKeys.TryGetValue(name, out string? key))
        {
            questionState = default;
            return false;
        }

        SurveyConditionalState state = _states[key];
        questionState = new SurveyQuestionState(
            state.IsVisible,
            state.IsEnabled,
            state.IsRequired,
            IsReachable(state));
        return true;
    }

    private void AddRule(
        SurveyRuntimeCondition condition,
        SurveyConditionKind kind,
        SurveyExpression? expression)
    {
        if (expression is null)
        {
            return;
        }

        string key = $"condition:{condition.Key}:{kind}";
        _rules.Add(key, new SurveyConditionRule(_states[condition.Key], kind, expression));
        _graph.AddNode(DependencyNode.FromExpression(key, expression));
    }

    private void Settle(
        DependencyPlan plan,
        ICollection<SurveyElementStateChangedEventArgs>? changes)
    {
        foreach (string key in plan.Order)
        {
            SurveyConditionRule rule = _rules[key];
            ExpressionEvaluationResult evaluation = rule.Expression.Evaluate(
                _survey.CreateExpressionContext());
            bool value = evaluation.Errors.Count == 0
                ? KajayValueSemantics.IsTruthy(evaluation.Value)
                : rule.Kind != SurveyConditionKind.Required;
            if (!Apply(rule.State, rule.Kind, value))
            {
                continue;
            }

            changes?.Add(new SurveyElementStateChangedEventArgs(
                rule.State.Definition.Name,
                rule.State.Definition.ElementKind,
                rule.Kind,
                value));
        }
    }

    private bool IsReachable(SurveyConditionalState state)
    {
        if (!state.IsVisible || !IsPageVisible(state.Definition.PageIndex))
        {
            return false;
        }

        string? parentKey = state.Definition.ParentKey;
        while (parentKey is not null)
        {
            SurveyConditionalState parent = _states[parentKey];
            if (!parent.IsVisible)
            {
                return false;
            }

            parentKey = parent.Definition.ParentKey;
        }

        return true;
    }

    private static bool Apply(
        SurveyConditionalState state,
        SurveyConditionKind kind,
        bool value)
    {
        bool previous = kind switch
        {
            SurveyConditionKind.Visible => state.IsVisible,
            SurveyConditionKind.Enabled => state.IsEnabled,
            SurveyConditionKind.Required => state.IsRequired,
            _ => throw new InvalidOperationException("Unknown survey condition kind."),
        };
        if (previous == value)
        {
            return false;
        }

        switch (kind)
        {
            case SurveyConditionKind.Visible:
                state.IsVisible = value;
                break;
            case SurveyConditionKind.Enabled:
                state.IsEnabled = value;
                break;
            case SurveyConditionKind.Required:
                state.IsRequired = value;
                break;
        }

        return true;
    }
}
