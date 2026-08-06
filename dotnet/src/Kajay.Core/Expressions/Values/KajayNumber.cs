using System.Globalization;

namespace Kajay.Expressions.Values;

internal static class KajayNumber
{
    public static bool TryConvert(KajayValue value, out double number)
    {
        if (value.Kind == KajayValueKind.Number)
        {
            number = value.GetNumber();
            return true;
        }

        if (value.Kind == KajayValueKind.Text)
        {
            return TryParse(value.GetString(), out number);
        }

        number = default;
        return false;
    }

    private static bool TryParse(string text, out double number)
    {
        ReadOnlySpan<char> source = text.AsSpan().Trim();
        if (!HasDecimalGrammar(source))
        {
            number = default;
            return false;
        }

        return double.TryParse(
            source,
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out number)
            && double.IsFinite(number);
    }

    private static bool HasDecimalGrammar(ReadOnlySpan<char> source)
    {
        int index = ReadSign(source, 0);
        int integerStart = index;
        index = ReadDigits(source, index);
        bool hasDigits = index > integerStart;

        if (index < source.Length && source[index] == '.')
        {
            int fractionStart = index + 1;
            index = ReadDigits(source, fractionStart);
            hasDigits |= index > fractionStart;
        }

        if (!hasDigits)
        {
            return false;
        }

        if (index < source.Length && source[index] is 'e' or 'E')
        {
            index = ReadSign(source, index + 1);
            int exponentStart = index;
            index = ReadDigits(source, index);
            if (index == exponentStart)
            {
                return false;
            }
        }

        return index == source.Length;
    }

    private static int ReadSign(ReadOnlySpan<char> source, int index)
    {
        return index < source.Length && source[index] is '+' or '-' ? index + 1 : index;
    }

    private static int ReadDigits(ReadOnlySpan<char> source, int index)
    {
        while (index < source.Length && source[index] is >= '0' and <= '9')
        {
            index += 1;
        }

        return index;
    }
}
