using System.Globalization;
using System.Text;

namespace Kajay.Expressions;

internal sealed class ExpressionPathParser
{
    private readonly string _raw;
    private readonly TextSpan _span;
    private readonly ICollection<ExpressionError> _errors;
    private readonly List<ExpressionPathSegment> _segments = [];
    private readonly StringBuilder _name = new();
    private int _position;

    private ExpressionPathParser(
        string raw,
        TextSpan span,
        ICollection<ExpressionError> errors)
    {
        _raw = raw;
        _span = span;
        _errors = errors;
    }

    internal static ExpressionPath Parse(
        string raw,
        TextSpan span,
        ICollection<ExpressionError> errors)
    {
        var parser = new ExpressionPathParser(raw, span, errors);
        return parser.Parse();
    }

    private ExpressionPath Parse()
    {
        while (_position < _raw.Length)
        {
            char character = _raw[_position];
            if (character == '.')
            {
                FlushName();
                _position += 1;
            }
            else if (character == '[')
            {
                FlushName();
                ReadIndex();
            }
            else
            {
                _ = _name.Append(character);
                _position += 1;
            }
        }

        FlushName();
        if (_segments.Count == 0)
        {
            _errors.Add(new ExpressionError("empty-reference", _span));
        }
        return new ExpressionPath(_segments.ToArray());
    }

    private void ReadIndex()
    {
        int closing = _raw.IndexOf(']', _position + 1);
        string indexText = closing < 0
            ? _raw[(_position + 1)..]
            : _raw[(_position + 1)..closing];
        if (closing < 0
            || !int.TryParse(
                indexText.Trim(),
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int index)
            || index < 0)
        {
            _errors.Add(new ExpressionError("invalid-reference-index", _span));
        }
        else
        {
            _segments.Add(ExpressionPathSegment.FromIndex(index));
        }

        _position = closing < 0 ? _raw.Length : closing + 1;
    }

    private void FlushName()
    {
        if (_name.Length == 0)
        {
            return;
        }
        _segments.Add(ExpressionPathSegment.FromName(_name.ToString()));
        _ = _name.Clear();
    }
}
