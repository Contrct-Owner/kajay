using System.Collections.ObjectModel;

namespace Kajay;

/// <summary>Immutable inputs used by one expression evaluation.</summary>
public sealed class ExpressionEvaluationContext
{
    /// <summary>Creates an evaluation context with no answer values.</summary>
    /// <param name="clock">The explicit clock read by date functions.</param>
    public ExpressionEvaluationContext(DateTimeOffset clock)
        : this(clock, Array.Empty<KeyValuePair<string, KajayValue>>())
    {
    }

    /// <summary>Creates an evaluation context by copying its answer values.</summary>
    /// <param name="clock">The explicit clock read by date functions.</param>
    /// <param name="values">Top-level values with exact, ordinal names.</param>
    /// <exception cref="ArgumentException">A value name occurs more than once.</exception>
    public ExpressionEvaluationContext(
        DateTimeOffset clock,
        IEnumerable<KeyValuePair<string, KajayValue>> values)
    {
        ArgumentNullException.ThrowIfNull(values);
        Clock = clock.ToUniversalTime();

        Dictionary<string, KajayValue> copy = new(StringComparer.Ordinal);
        foreach ((string name, KajayValue value) in values)
        {
            ArgumentNullException.ThrowIfNull(name);
            if (!copy.TryAdd(name, value))
            {
                throw new ArgumentException(
                    $"The value name '{name}' occurs more than once.",
                    nameof(values));
            }
        }

        Values = new ReadOnlyDictionary<string, KajayValue>(copy);
    }

    /// <summary>Gets the explicit UTC clock.</summary>
    public DateTimeOffset Clock { get; }

    /// <summary>Gets the immutable top-level answer values.</summary>
    public IReadOnlyDictionary<string, KajayValue> Values { get; }
}
