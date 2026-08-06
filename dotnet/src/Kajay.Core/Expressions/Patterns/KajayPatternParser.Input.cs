using System.Buffers;
using System.Text;

namespace Kajay.Expressions.Patterns;

internal sealed partial class KajayPatternParser
{
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

    private KajayScalarPattern.Literal FailedClass()
    {
        _valid = false;
        return new KajayScalarPattern.Literal(0);
    }

    private KajayPatternNode.Empty Fail()
    {
        _valid = false;
        return new KajayPatternNode.Empty();
    }
}
