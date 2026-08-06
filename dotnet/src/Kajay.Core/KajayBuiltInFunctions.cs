namespace Kajay;

internal static class KajayBuiltInFunctions
{
    public static bool IsRegistered(string name)
    {
        return name.Equals("today", StringComparison.OrdinalIgnoreCase)
            || name.Equals("currentDate", StringComparison.OrdinalIgnoreCase)
            || name.Equals("diffDays", StringComparison.OrdinalIgnoreCase)
            || name.Equals("getDate", StringComparison.OrdinalIgnoreCase)
            || name.Equals("round", StringComparison.OrdinalIgnoreCase);
    }

    public static KajayValue Evaluate(
        string name,
        IReadOnlyList<KajayValue> arguments,
        DateTimeOffset clock)
    {
        if (name.Equals("today", StringComparison.OrdinalIgnoreCase))
        {
            return EvaluateToday(arguments, clock);
        }

        if (name.Equals("currentDate", StringComparison.OrdinalIgnoreCase))
        {
            return KajayValue.From(clock);
        }

        if (name.Equals("round", StringComparison.OrdinalIgnoreCase))
        {
            return EvaluateRound(arguments);
        }

        if (name.Equals("getDate", StringComparison.OrdinalIgnoreCase))
        {
            return EvaluateGetDate(arguments);
        }

        return name.Equals("diffDays", StringComparison.OrdinalIgnoreCase)
            ? EvaluateDiffDays(arguments)
            : KajayValue.Absent;
    }

    private static KajayValue EvaluateToday(
        IReadOnlyList<KajayValue> arguments,
        DateTimeOffset clock)
    {
        double offset = arguments.Count > 0
            && KajayNumber.TryConvert(arguments[0], out double parsedOffset)
                ? parsedOffset
                : 0;
        DateTimeOffset midnight = new(
            clock.Year,
            clock.Month,
            clock.Day,
            0,
            0,
            0,
            TimeSpan.Zero);
        try
        {
            return KajayValue.From(midnight.AddDays(offset));
        }
        catch (ArgumentOutOfRangeException)
        {
            return KajayValue.Absent;
        }
    }

    private static KajayValue EvaluateDiffDays(IReadOnlyList<KajayValue> arguments)
    {
        if (arguments.Count < 2
            || !KajayInstant.TryConvert(arguments[0], out DateTimeOffset from)
            || !KajayInstant.TryConvert(arguments[1], out DateTimeOffset to))
        {
            return KajayValue.Absent;
        }

        double days = (to.UtcDateTime.Date - from.UtcDateTime.Date).TotalDays;
        return KajayValue.From(days);
    }

    private static KajayValue EvaluateRound(IReadOnlyList<KajayValue> arguments)
    {
        if (arguments.Count == 0
            || !KajayNumber.TryConvert(arguments[0], out double value))
        {
            return KajayValue.Absent;
        }

        double precision = arguments.Count > 1
            && KajayNumber.TryConvert(arguments[1], out double parsedPrecision)
                ? parsedPrecision
                : 0;
        return KajayRounding.TryRound(value, precision, out double rounded)
            ? KajayValue.From(rounded)
            : KajayValue.Absent;
    }

    private static KajayValue EvaluateGetDate(IReadOnlyList<KajayValue> arguments)
    {
        return arguments.Count > 0
            && KajayInstant.TryConvert(arguments[0], out DateTimeOffset instant)
                ? KajayValue.From(instant)
                : KajayValue.Absent;
    }
}
