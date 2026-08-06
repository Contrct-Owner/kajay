namespace Kajay;

public sealed partial class Survey
{
    /// <summary>Runs asynchronous expression functions to a deterministic fixed point.</summary>
    public async Task SettleAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (IsSettling)
        {
            throw new InvalidOperationException("Survey expression settlement is already in progress.");
        }

        IsSettling = true;
        _logicErrors.Reset();
        try
        {
            for (int pass = 0; pass < LogicCascadeLimit; pass += 1)
            {
                _asyncFunctionValues.Begin(_timeProvider.GetUtcNow(), cancellationToken);
                SettleAllLogic();
                Task<bool> expressions = _asyncFunctionValues.ResolvePendingAsync();
                Task<bool> choices = _choiceSources.SettleAsync(cancellationToken);
                await Task.WhenAll(expressions, choices).ConfigureAwait(false);
                if (!expressions.Result && !choices.Result)
                {
                    return;
                }
            }

            throw new InvalidOperationException("Asynchronous expression settlement did not converge.");
        }
        finally
        {
            IsSettling = false;
        }
    }

    internal void RecordLogicErrors(IReadOnlyList<ExpressionError> errors)
    {
        _logicErrors.Record(errors);
    }

    internal ExpressionEvaluationContext CreateExpressionContext()
    {
        return CreateExpressionContext([]);
    }

    internal ExpressionEvaluationContext CreateExpressionContext(
        IEnumerable<KeyValuePair<string, KajayValue>> additionalValues)
    {
        return new ExpressionEvaluationContext(
            _timeProvider.GetUtcNow(),
            new SurveyExpressionValues(this, additionalValues),
            _expressionFunctions,
            _asyncFunctionValues);
    }

    private void SettleAllLogic()
    {
        List<SurveyValueChangedEventArgs> changes = [];
        List<SurveyElementStateChangedEventArgs> stateChanges = [];
        IReadOnlyList<ExpressionPath> calculatedWrites = _calculatedValues.SettleAll(changes);
        _conditions.Establish(stateChanges);
        _visiblePageIndexes = _conditions.GetVisiblePageIndexes();
        IReadOnlyList<ExpressionPath> triggerWrites = _triggers.SettleAll(changes);
        if (calculatedWrites.Count > 0 || triggerWrites.Count > 0)
        {
            SettleLogic([.. calculatedWrites, .. triggerWrites], changes, stateChanges);
        }
        _choiceSources.SettleSynchronous();

        foreach (SurveyValueChangedEventArgs change in changes)
        {
            if (!_isRestoringSnapshot)
            {
                ValueChanged?.Invoke(this, change);
            }
        }
        foreach (SurveyElementStateChangedEventArgs change in stateChanges)
        {
            if (!_isRestoringSnapshot)
            {
                ElementStateChanged?.Invoke(this, change);
            }
        }
    }

    private void SettleLogic(
        IReadOnlyList<ExpressionPath> initialChanges,
        ICollection<SurveyValueChangedEventArgs> changes,
        ICollection<SurveyElementStateChangedEventArgs> stateChanges)
    {
        IReadOnlyList<ExpressionPath> pending = initialChanges;
        for (int cascade = 0; cascade < LogicCascadeLimit; cascade += 1)
        {
            IReadOnlyList<ExpressionPath> calculatedWrites =
                _calculatedValues.Recalculate(pending, changes);
            ExpressionPath[] triggerInputs = [.. pending, .. calculatedWrites];
            _conditions.Settle(triggerInputs, stateChanges);
            _visiblePageIndexes = _conditions.GetVisiblePageIndexes();
            IReadOnlyList<ExpressionPath> triggerWrites =
                _triggers.Settle(triggerInputs, changes);
            if (triggerWrites.Count == 0)
            {
                break;
            }

            pending = triggerWrites;
        }

        ClampCurrentPage();
    }
}
