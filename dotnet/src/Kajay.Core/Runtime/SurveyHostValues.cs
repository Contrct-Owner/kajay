namespace Kajay.Runtime;

/// <summary>The host's values, held apart from the answers and the calculated results.</summary>
/// <remarks>
/// A third store rather than a corner of one of the others, because the three differ in exactly
/// the way that matters: an answer is the respondent's and reaches the response, a calculated
/// value is the definition's and reaches it only when asked to, and this is the host's and never
/// reaches it at all. Keeping it out of the answer map is what makes that last guarantee
/// structural rather than a filter somebody maintains.
/// </remarks>
internal sealed class SurveyHostValues
{
    private readonly Dictionary<string, KajayValue> _values = new(StringComparer.Ordinal);

    internal SurveyHostValues(IReadOnlyDictionary<string, KajayValue>? values)
    {
        if (values is null)
        {
            return;
        }

        foreach ((string key, KajayValue value) in values)
        {
            _values[key] = value;
        }
    }

    /// <summary>Gets the value for a key, or absent when the host supplied none.</summary>
    /// <param name="key">The exact ordinal host-value key.</param>
    /// <param name="value">The supplied value when present.</param>
    /// <returns>True when the host supplied this key.</returns>
    internal bool TryGetValue(string key, out KajayValue value)
    {
        return _values.TryGetValue(key, out value);
    }

    /// <summary>Records a value, reporting whether it actually changed.</summary>
    /// <param name="key">The exact ordinal host-value key.</param>
    /// <param name="value">The value to record.</param>
    /// <returns>True when the store now holds something different.</returns>
    /// <remarks>
    /// A host handing back the value already in force must not start a settle, or a host that
    /// refreshes its context on a timer would recompute the survey forever.
    /// </remarks>
    internal bool Set(string key, KajayValue value)
    {
        if (_values.TryGetValue(key, out KajayValue existing) && existing.Equals(value))
        {
            return false;
        }

        _values[key] = value;
        return true;
    }
}
