using System.Collections.ObjectModel;

namespace Kajay;

/// <summary>A value accepted and produced by the Kajay expression language.</summary>
public readonly struct KajayValue : IEquatable<KajayValue>
{
    private readonly object? _content;

    private KajayValue(KajayValueKind kind, object? content)
    {
        Kind = kind;
        _content = content;
    }

    /// <summary>Gets the value's algebra member.</summary>
    public KajayValueKind Kind { get; }

    /// <summary>Gets the distinguished absent value.</summary>
    public static KajayValue Absent => default;

    /// <summary>Gets the explicit JSON null value.</summary>
    public static KajayValue Null => new(KajayValueKind.Null, null);

    /// <summary>Creates a Boolean value.</summary>
    /// <param name="value">The Boolean.</param>
    /// <returns>The corresponding Kajay value.</returns>
    public static KajayValue From(bool value)
    {
        return new KajayValue(KajayValueKind.Boolean, value);
    }

    /// <summary>Creates a finite number value.</summary>
    /// <param name="value">The finite IEEE-754 binary64 number.</param>
    /// <returns>The corresponding Kajay value.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="value"/> is not finite.
    /// </exception>
    public static KajayValue From(double value)
    {
        ArgumentOutOfRangeException.ThrowIfNotEqual(double.IsFinite(value), true, nameof(value));
        return new KajayValue(KajayValueKind.Number, value == 0 ? 0d : value);
    }

    /// <summary>Creates a string value.</summary>
    /// <param name="value">The string.</param>
    /// <returns>The corresponding Kajay value.</returns>
    public static KajayValue From(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return new KajayValue(KajayValueKind.Text, value);
    }

    /// <summary>Creates a UTC instant value with millisecond precision.</summary>
    /// <param name="value">The instant.</param>
    /// <returns>The corresponding Kajay value.</returns>
    public static KajayValue From(DateTimeOffset value)
    {
        long milliseconds = value.ToUnixTimeMilliseconds();
        return new KajayValue(
            KajayValueKind.Instant,
            DateTimeOffset.FromUnixTimeMilliseconds(milliseconds));
    }

    /// <summary>Creates an immutable array value by copying its items.</summary>
    /// <param name="values">Items in source order.</param>
    /// <returns>The corresponding Kajay value.</returns>
    public static KajayValue FromArray(IEnumerable<KajayValue> values)
    {
        ArgumentNullException.ThrowIfNull(values);
        ReadOnlyCollection<KajayValue> copy = Array.AsReadOnly(values.ToArray());
        return new KajayValue(KajayValueKind.Array, copy);
    }

    /// <summary>Creates an immutable object value by copying its properties.</summary>
    /// <param name="properties">Properties with exact, ordinal names.</param>
    /// <returns>The corresponding Kajay value.</returns>
    /// <exception cref="ArgumentException">A property name occurs more than once.</exception>
    public static KajayValue FromObject(
        IEnumerable<KeyValuePair<string, KajayValue>> properties)
    {
        ArgumentNullException.ThrowIfNull(properties);
        Dictionary<string, KajayValue> copy = new(StringComparer.Ordinal);
        foreach ((string name, KajayValue value) in properties)
        {
            ArgumentNullException.ThrowIfNull(name);
            if (!copy.TryAdd(name, value))
            {
                throw new ArgumentException(
                    $"The property name '{name}' occurs more than once.",
                    nameof(properties));
            }
        }

        return new KajayValue(
            KajayValueKind.Map,
            new ReadOnlyDictionary<string, KajayValue>(copy));
    }

    /// <summary>Gets the Boolean content.</summary>
    /// <returns>The Boolean.</returns>
    public bool GetBoolean()
    {
        EnsureKind(KajayValueKind.Boolean);
        return (bool)_content!;
    }

    /// <summary>Gets the numeric content.</summary>
    /// <returns>The finite number.</returns>
    public double GetNumber()
    {
        EnsureKind(KajayValueKind.Number);
        return (double)_content!;
    }

    /// <summary>Gets the string content.</summary>
    /// <returns>The string.</returns>
    public string GetString()
    {
        EnsureKind(KajayValueKind.Text);
        return (string)_content!;
    }

    /// <summary>Gets the UTC instant content.</summary>
    /// <returns>The UTC instant with millisecond precision.</returns>
    public DateTimeOffset GetInstant()
    {
        EnsureKind(KajayValueKind.Instant);
        return (DateTimeOffset)_content!;
    }

    /// <summary>Gets the immutable array content.</summary>
    /// <returns>The ordered values.</returns>
    public IReadOnlyList<KajayValue> GetArray()
    {
        EnsureKind(KajayValueKind.Array);
        return (IReadOnlyList<KajayValue>)_content!;
    }

    /// <summary>Gets the immutable object content.</summary>
    /// <returns>The exact, ordinal property map.</returns>
    public IReadOnlyDictionary<string, KajayValue> GetObject()
    {
        EnsureKind(KajayValueKind.Map);
        return (IReadOnlyDictionary<string, KajayValue>)_content!;
    }

    /// <inheritdoc />
    public bool Equals(KajayValue other)
    {
        return KajayValueComparer.Equals(this, other);
    }

    /// <inheritdoc />
    public override bool Equals(object? obj)
    {
        return obj is KajayValue other && Equals(other);
    }

    /// <inheritdoc />
    public override int GetHashCode()
    {
        return KajayValueComparer.GetHashCode(this);
    }

    /// <summary>Compares two Kajay values structurally.</summary>
    public static bool operator ==(KajayValue left, KajayValue right)
    {
        return left.Equals(right);
    }

    /// <summary>Compares two Kajay values structurally.</summary>
    public static bool operator !=(KajayValue left, KajayValue right)
    {
        return !left.Equals(right);
    }

    private void EnsureKind(KajayValueKind expected)
    {
        if (Kind != expected)
        {
            throw new InvalidOperationException(
                $"A {Kind} Kajay value cannot be read as {expected}.");
        }
    }
}
