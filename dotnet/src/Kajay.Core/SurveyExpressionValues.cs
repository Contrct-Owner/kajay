namespace Kajay;

internal sealed class SurveyExpressionValues : IReadOnlyDictionary<string, KajayValue>
{
    private readonly Survey _survey;
    private readonly Dictionary<string, KajayValue> _additionalValues;

    internal SurveyExpressionValues(
        Survey survey,
        IEnumerable<KeyValuePair<string, KajayValue>> additionalValues)
    {
        _survey = survey;
        _additionalValues = new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        foreach ((string name, KajayValue value) in additionalValues)
        {
            _additionalValues[name] = value;
        }
    }

    public KajayValue this[string key] => TryGetValue(key, out KajayValue value)
        ? value
        : throw new KeyNotFoundException();

    public IEnumerable<string> Keys => Snapshot().Keys;

    public IEnumerable<KajayValue> Values => Snapshot().Values;

    public int Count => Snapshot().Count;

    public bool ContainsKey(string key)
    {
        return TryGetValue(key, out _);
    }

    public bool TryGetValue(string key, out KajayValue value)
    {
        return _additionalValues.TryGetValue(key, out value)
            || _survey.TryGetValue(key, out value);
    }

    public IEnumerator<KeyValuePair<string, KajayValue>> GetEnumerator()
    {
        return Snapshot().GetEnumerator();
    }

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
    {
        return GetEnumerator();
    }

    private Dictionary<string, KajayValue> Snapshot()
    {
        var snapshot = new Dictionary<string, KajayValue>(_survey.Data, StringComparer.Ordinal);
        foreach ((string name, KajayValue value) in _additionalValues)
        {
            snapshot[name] = value;
        }

        return snapshot;
    }
}
