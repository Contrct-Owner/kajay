using System.Buffers;
using System.Text;

namespace Kajay;

internal static class KajayPatternSyntax
{
    private const int MaxSourceScalars = 512;
    private const int MaxCompiledStates = 4_096;
    private const int MaxRepetition = 1_000;

    public static bool IsValid(string source)
    {
        ArgumentNullException.ThrowIfNull(source);
        if (source.EnumerateRunes().Take(MaxSourceScalars + 1).Count() > MaxSourceScalars)
        {
            return false;
        }

        var parser = new Parser(source);
        return parser.Parse();
    }

    private sealed class Parser
    {
        private readonly string _source;
        private int _index;
        private bool _valid = true;

        public Parser(string source)
        {
            _source = source;
        }

        public bool Parse()
        {
            int states = ParseAlternation(null);
            return _valid && _index == _source.Length && states <= MaxCompiledStates;
        }

        private int ParseAlternation(char? terminator)
        {
            int states = ParseSequence(terminator);
            while (PeekAscii() == '|')
            {
                _index += 1;
                states = BoundedAdd(states, ParseSequence(terminator), 2);
            }

            return states;
        }

        private int ParseSequence(char? terminator)
        {
            int states = 0;
            while (_index < _source.Length)
            {
                char? current = PeekAscii();
                if (current == '|' || current == terminator)
                {
                    break;
                }

                states = BoundedAdd(states, ParseAtom());
            }

            return states;
        }

        private int ParseAtom()
        {
            char? current = PeekAscii();
            if (current is null)
            {
                return TakeScalar() is null ? Fail() : ParseQuantifier(1);
            }

            _index += 1;
            int states = 1;
            bool quantifiable = true;
            switch (current)
            {
                case ')' or ']' or '}' or '*' or '+' or '?' or '{':
                    return Fail();
                case '^' or '$':
                    quantifiable = false;
                    break;
                case '(':
                    if (PeekAscii() == '?')
                    {
                        return Fail();
                    }

                    states = ParseAlternation(')');
                    if (!TakeAscii(')'))
                    {
                        return Fail();
                    }

                    states = BoundedAdd(states, 2);
                    break;
                case '[':
                    states = ParseCharacterClass();
                    break;
                case '\\':
                    if (!ParseEscape())
                    {
                        return Fail();
                    }

                    break;
            }

            return quantifiable ? ParseQuantifier(states) : states;
        }

        private int ParseCharacterClass()
        {
            if (PeekAscii() == '^')
            {
                _index += 1;
            }

            bool hasItem = false;
            while (_index < _source.Length && PeekAscii() != ']')
            {
                int? rangeStart = ParseClassItem();
                if (rangeStart is null)
                {
                    return Fail();
                }

                hasItem = true;
                if (PeekAscii() == '-')
                {
                    _index += 1;
                    int? rangeEnd = ParseClassItem();
                    if (rangeStart < 0 || rangeEnd is null || rangeEnd < 0 || rangeEnd < rangeStart)
                    {
                        return Fail();
                    }
                }
            }

            return hasItem && TakeAscii(']') ? 1 : Fail();
        }

        private int? ParseClassItem()
        {
            if (PeekAscii() is ']' or '-')
            {
                return null;
            }

            if (PeekAscii() == '\\')
            {
                _index += 1;
                char? escaped = PeekAscii();
                if (!ParseEscape())
                {
                    return null;
                }

                return escaped is 'd' or 'D' or 'w' or 'W' or 's' or 'S'
                    ? -1
                    : escaped;
            }

            return TakeScalar();
        }

        private bool ParseEscape()
        {
            int? escaped = TakeScalar();
            if (escaped is null)
            {
                return false;
            }

            if (escaped is 'd' or 'D' or 'w' or 'W' or 's' or 'S')
            {
                return true;
            }

            var rune = new Rune(escaped.Value);
            return !Rune.IsLetterOrDigit(rune);
        }

        private int ParseQuantifier(int states)
        {
            char? current = PeekAscii();
            if (current is '*' or '+' or '?')
            {
                _index += 1;
                return BoundedAdd(states, 2);
            }

            if (current != '{')
            {
                return states;
            }

            _index += 1;
            int? minimum = ParseDecimal();
            if (minimum is null)
            {
                return Fail();
            }

            int? maximum = minimum;
            if (PeekAscii() == ',')
            {
                _index += 1;
                maximum = ParseDecimal();
            }

            if (maximum is null || !TakeAscii('}')
                || maximum < minimum || maximum > MaxRepetition)
            {
                return Fail();
            }

            return BoundedMultiply(states, maximum.Value, maximum.Value - minimum.Value);
        }

        private int? ParseDecimal()
        {
            int start = _index;
            int value = 0;
            while (PeekAscii() is >= '0' and <= '9')
            {
                value = Math.Min(MaxRepetition + 1, (value * 10) + (_source[_index] - '0'));
                _index += 1;
            }

            return _index == start ? null : value;
        }

        private int? TakeScalar()
        {
            if (_index >= _source.Length)
            {
                return null;
            }

            OperationStatus status = Rune.DecodeFromUtf16(
                _source.AsSpan(_index),
                out Rune rune,
                out int consumed);
            if (status != OperationStatus.Done)
            {
                _valid = false;
                return null;
            }

            _index += consumed;
            return rune.Value;
        }

        private char? PeekAscii()
        {
            return _index < _source.Length && _source[_index] <= 0x7f
                ? _source[_index]
                : null;
        }

        private bool TakeAscii(char expected)
        {
            if (PeekAscii() != expected)
            {
                return false;
            }

            _index += 1;
            return true;
        }

        private int BoundedAdd(params int[] values)
        {
            long total = values.Sum(value => (long)value);
            return total > MaxCompiledStates ? Fail() : (int)total;
        }

        private int BoundedMultiply(int states, int count, int extra)
        {
            long total = ((long)states * count) + extra;
            return total > MaxCompiledStates ? Fail() : (int)total;
        }

        private int Fail()
        {
            _valid = false;
            return MaxCompiledStates + 1;
        }
    }
}
