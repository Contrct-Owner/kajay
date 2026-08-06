namespace Kajay;

public sealed partial class Survey
{
    /// <summary>Gets an immutable snapshot of answers and included calculated values.</summary>
    public IReadOnlyDictionary<string, KajayValue> Data
    {
        get
        {
            var data = new Dictionary<string, KajayValue>(_answers, StringComparer.Ordinal);
            _calculatedValues.CopyIncludedTo(data);
            return new System.Collections.ObjectModel.ReadOnlyDictionary<string, KajayValue>(data);
        }
    }

    /// <summary>Gets an answer, or otherwise a calculated value, by exact name.</summary>
    /// <param name="name">The exact ordinal value name.</param>
    /// <param name="value">The resolved value when present.</param>
    /// <returns>True when an answer or calculated value exists.</returns>
    public bool TryGetValue(string name, out KajayValue value)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _answers.TryGetValue(name, out value)
            || _calculatedValues.TryGetValue(name, out value);
    }

    /// <summary>Gets a calculated value without falling back to an answer of the same name.</summary>
    /// <param name="name">The exact ordinal calculated-value name.</param>
    /// <param name="value">The current calculated value when present.</param>
    /// <returns>True when the named calculated value has a result.</returns>
    public bool TryGetCalculatedValue(string name, out KajayValue value)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _calculatedValues.TryGetValue(name, out value);
    }

    /// <summary>Sets or removes one answer and announces an actual change once.</summary>
    /// <param name="name">The exact answer name.</param>
    /// <param name="value">The new value; absent removes the answer.</param>
    public void SetValue(string name, KajayValue value)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        SurveyState previousState = State;
        List<SurveyValueChangedEventArgs> changes = [];
        List<SurveyElementStateChangedEventArgs> stateChanges = [];
        if (!WriteValue(name, value, changes))
        {
            return;
        }

        _logicErrors.Reset();
        SettleLogic([ExpressionPath.FromName(name)], changes, stateChanges);
        _choiceSources.SettleSynchronous();
        Validation.RevalidateChangedValues(changes.Select(change => change.Name));
        foreach (SurveyValueChangedEventArgs change in changes)
        {
            ValueChanged?.Invoke(this, change);
        }
        foreach (SurveyElementStateChangedEventArgs change in stateChanges)
        {
            ElementStateChanged?.Invoke(this, change);
        }
        if (State != previousState && State is SurveyState.Empty or SurveyState.Running)
        {
            RaiseStateChanged();
        }
    }

    /// <summary>Sets an answer, then awaits every newly reachable asynchronous function.</summary>
    public async Task SetValueAsync(
        string name,
        KajayValue value,
        CancellationToken cancellationToken = default)
    {
        SetValue(name, value);
        await SettleAsync(cancellationToken).ConfigureAwait(false);
    }

    internal bool WriteValue(
        string name,
        KajayValue value,
        ICollection<SurveyValueChangedEventArgs> changes)
    {
        bool hadPrevious = _answers.TryGetValue(name, out KajayValue previousValue);
        if (value.Kind == KajayValueKind.Absent)
        {
            if (!hadPrevious)
            {
                return false;
            }

            _answers.Remove(name);
        }
        else
        {
            if (hadPrevious && previousValue == value)
            {
                return false;
            }

            _answers[name] = value;
        }

        changes.Add(new SurveyValueChangedEventArgs(name, previousValue, value));
        return true;
    }

    internal KajayValue GetValue(string name)
    {
        return TryGetValue(name, out KajayValue value) ? value : KajayValue.Absent;
    }

    internal KajayValue ResolveValuePath(string raw)
    {
        List<ExpressionError> errors = [];
        ExpressionPath path = ExpressionPath.Parse(raw, new TextSpan(0, raw.Length), errors);
        if (errors.Count > 0 || path.Segments.Count == 0 || path.Segments[0].IsIndex)
        {
            return KajayValue.Absent;
        }

        KajayValue value = GetValue(path.Segments[0].Name!);
        foreach (ExpressionPathSegment segment in path.Segments.Skip(1))
        {
            if (segment.IsIndex)
            {
                if (value.Kind != KajayValueKind.Array
                    || segment.Index >= value.GetArray().Count)
                {
                    return KajayValue.Absent;
                }

                value = value.GetArray()[segment.Index];
            }
            else if (value.Kind != KajayValueKind.Map
                || !value.GetObject().TryGetValue(segment.Name!, out value))
            {
                return KajayValue.Absent;
            }
        }

        return value;
    }

    private static bool DataMatches(
        IReadOnlyDictionary<string, KajayValue> expected,
        IReadOnlyDictionary<string, KajayValue> actual)
    {
        return expected.Count == actual.Count
            && expected.All(entry => actual.TryGetValue(entry.Key, out KajayValue value)
                && value == entry.Value);
    }
}
