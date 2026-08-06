namespace Kajay.Expressions.Values;

internal static class KajayRounding
{
    public static bool TryRound(double value, double precision, out double rounded)
    {
        double factor = Math.Pow(10, precision);
        double scaled = value * factor;
        if (!double.IsFinite(factor) || factor == 0 || !double.IsFinite(scaled))
        {
            rounded = default;
            return false;
        }

        rounded = Math.Round(scaled, MidpointRounding.AwayFromZero) / factor;
        return double.IsFinite(rounded);
    }
}
