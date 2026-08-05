namespace Kajay;

internal static class KajayBuiltInFunctions
{
    public static bool IsRegistered(string name)
    {
        return name.Equals("today", StringComparison.OrdinalIgnoreCase);
    }

    public static KajayValue Evaluate(
        string name,
        IReadOnlyList<KajayValue> arguments,
        DateTimeOffset clock)
    {
        return name.Equals("today", StringComparison.OrdinalIgnoreCase)
            ? EvaluateToday(arguments, clock)
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
}
