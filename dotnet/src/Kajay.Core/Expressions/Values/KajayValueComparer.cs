namespace Kajay.Expressions.Values;

internal static class KajayValueComparer
{
    public static bool Equals(KajayValue left, KajayValue right)
    {
        if (left.Kind != right.Kind)
        {
            return false;
        }

        return left.Kind switch
        {
            KajayValueKind.Absent or KajayValueKind.Null => true,
            KajayValueKind.Boolean => left.GetBoolean() == right.GetBoolean(),
            KajayValueKind.Number => left.GetNumber() == right.GetNumber(),
            KajayValueKind.Text => left.GetString() == right.GetString(),
            KajayValueKind.Instant => left.GetInstant() == right.GetInstant(),
            KajayValueKind.Array => ArraysEqual(left.GetArray(), right.GetArray()),
            KajayValueKind.Map => ObjectsEqual(left.GetObject(), right.GetObject()),
            _ => throw new ArgumentOutOfRangeException(nameof(left)),
        };
    }

    public static int GetHashCode(KajayValue value)
    {
        return value.Kind switch
        {
            KajayValueKind.Absent or KajayValueKind.Null => HashCode.Combine(value.Kind),
            KajayValueKind.Boolean => HashCode.Combine(value.Kind, value.GetBoolean()),
            KajayValueKind.Number => HashCode.Combine(value.Kind, value.GetNumber()),
            KajayValueKind.Text => HashCode.Combine(value.Kind, value.GetString()),
            KajayValueKind.Instant => HashCode.Combine(value.Kind, value.GetInstant()),
            KajayValueKind.Array => ArrayHashCode(value.GetArray()),
            KajayValueKind.Map => ObjectHashCode(value.GetObject()),
            _ => throw new ArgumentOutOfRangeException(nameof(value)),
        };
    }

    private static bool ArraysEqual(
        IReadOnlyList<KajayValue> left,
        IReadOnlyList<KajayValue> right)
    {
        return left.Count == right.Count && left.SequenceEqual(right);
    }

    private static bool ObjectsEqual(
        IReadOnlyDictionary<string, KajayValue> left,
        IReadOnlyDictionary<string, KajayValue> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        foreach ((string name, KajayValue value) in left)
        {
            if (!right.TryGetValue(name, out KajayValue other) || value != other)
            {
                return false;
            }
        }

        return true;
    }

    private static int ArrayHashCode(IReadOnlyList<KajayValue> values)
    {
        HashCode hash = new();
        hash.Add(KajayValueKind.Array);
        foreach (KajayValue value in values)
        {
            hash.Add(value);
        }

        return hash.ToHashCode();
    }

    private static int ObjectHashCode(IReadOnlyDictionary<string, KajayValue> properties)
    {
        int entries = 0;
        foreach ((string name, KajayValue value) in properties)
        {
            entries ^= HashCode.Combine(
                StringComparer.Ordinal.GetHashCode(name),
                value.GetHashCode());
        }

        return HashCode.Combine(KajayValueKind.Map, properties.Count, entries);
    }
}
