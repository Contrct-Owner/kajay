using System.Collections.ObjectModel;

namespace Kajay;

/// <summary>Immutable inputs used by one expression evaluation.</summary>
public sealed class ExpressionEvaluationContext
{
    /// <summary>Creates an evaluation context with no answer values.</summary>
    /// <param name="clock">The explicit clock read by date functions.</param>
    public ExpressionEvaluationContext(DateTimeOffset clock)
        : this(
            clock,
            Array.Empty<KeyValuePair<string, KajayValue>>(),
            ExpressionFunctionRegistry.Empty)
    {
    }

    /// <summary>Creates an evaluation context with host-defined functions.</summary>
    /// <param name="clock">The explicit clock read by date functions.</param>
    /// <param name="functions">The immutable function registry.</param>
    public ExpressionEvaluationContext(
        DateTimeOffset clock,
        ExpressionFunctionRegistry functions)
        : this(clock, Array.Empty<KeyValuePair<string, KajayValue>>(), functions)
    {
    }

    /// <summary>Creates an evaluation context by copying its answer values.</summary>
    /// <param name="clock">The explicit clock read by date functions.</param>
    /// <param name="values">Top-level values with exact, ordinal names.</param>
    /// <exception cref="ArgumentException">A value name occurs more than once.</exception>
    public ExpressionEvaluationContext(
        DateTimeOffset clock,
        IEnumerable<KeyValuePair<string, KajayValue>> values)
        : this(clock, values, ExpressionFunctionRegistry.Empty)
    {
    }

    /// <summary>Creates an evaluation context by copying values and functions.</summary>
    /// <param name="clock">The explicit clock read by date functions.</param>
    /// <param name="values">Top-level values with exact, ordinal names.</param>
    /// <param name="functions">The immutable function registry.</param>
    /// <exception cref="ArgumentException">A value name occurs more than once.</exception>
    public ExpressionEvaluationContext(
        DateTimeOffset clock,
        IEnumerable<KeyValuePair<string, KajayValue>> values,
        ExpressionFunctionRegistry functions)
    {
        ArgumentNullException.ThrowIfNull(values);
        ArgumentNullException.ThrowIfNull(functions);
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
        Functions = functions;
    }

    /// <summary>Gets the explicit UTC clock.</summary>
    public DateTimeOffset Clock { get; }

    /// <summary>Gets the immutable top-level answer values.</summary>
    public IReadOnlyDictionary<string, KajayValue> Values { get; }

    /// <summary>Gets the immutable host-defined function registry.</summary>
    public ExpressionFunctionRegistry Functions { get; }
}
