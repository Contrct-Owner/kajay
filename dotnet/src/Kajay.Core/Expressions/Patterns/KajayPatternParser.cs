using System.Text;

namespace Kajay.Expressions.Patterns;

internal sealed partial class KajayPatternParser
{
    private const int MaxSourceScalars = 512;
    private const int MaxRepetition = 1_000;
    private readonly string _source;
    private int _index;
    private bool _valid = true;

    private KajayPatternParser(string source)
    {
        _source = source;
    }

    public static KajayPatternNode? Parse(string source)
    {
        ArgumentNullException.ThrowIfNull(source);
        if (source.EnumerateRunes().Take(MaxSourceScalars + 1).Count() > MaxSourceScalars)
        {
            return null;
        }

        var parser = new KajayPatternParser(source);
        KajayPatternNode node = parser.ParseAlternation(null);
        return parser._valid && parser._index == source.Length ? node : null;
    }

    private KajayPatternNode ParseAlternation(char? terminator)
    {
        var alternatives = new List<KajayPatternNode> { ParseSequence(terminator) };
        while (PeekAscii() == '|')
        {
            _index += 1;
            alternatives.Add(ParseSequence(terminator));
        }

        return alternatives.Count == 1
            ? alternatives[0]
            : new KajayPatternNode.Alternation(alternatives);
    }

    private KajayPatternNode ParseSequence(char? terminator)
    {
        var items = new List<KajayPatternNode>();
        while (_index < _source.Length)
        {
            char? current = PeekAscii();
            if (current == '|' || current == terminator)
            {
                break;
            }

            items.Add(ParseAtom());
        }

        return items.Count switch
        {
            0 => new KajayPatternNode.Empty(),
            1 => items[0],
            _ => new KajayPatternNode.Sequence(items),
        };
    }

    private KajayPatternNode ParseAtom()
    {
        char? current = PeekAscii();
        if (current is null)
        {
            int? scalar = TakeScalar();
            return scalar is null
                ? Fail()
                : ParseQuantifier(new KajayPatternNode.Scalar(
                    new KajayScalarPattern.Literal(scalar.Value)));
        }

        _index += 1;
        KajayPatternNode node;
        switch (current)
        {
            case ')' or ']' or '}' or '*' or '+' or '?' or '{':
                return Fail();
            case '^':
                return new KajayPatternNode.Anchor(true);
            case '$':
                return new KajayPatternNode.Anchor(false);
            case '(':
                node = ParseGroup();
                break;
            case '[':
                node = new KajayPatternNode.Scalar(ParseCharacterClass());
                break;
            case '\\':
                KajayScalarPattern? escaped = ParseEscape();
                node = escaped is null
                    ? Fail()
                    : new KajayPatternNode.Scalar(escaped);
                break;
            case '.':
                node = new KajayPatternNode.Scalar(new KajayScalarPattern.Dot());
                break;
            default:
                node = new KajayPatternNode.Scalar(
                    new KajayScalarPattern.Literal(current.Value));
                break;
        }

        return ParseQuantifier(node);
    }

    private KajayPatternNode ParseGroup()
    {
        if (PeekAscii() == '?')
        {
            return Fail();
        }

        KajayPatternNode node = ParseAlternation(')');
        return TakeAscii(')') ? node : Fail();
    }

    private KajayScalarPattern ParseCharacterClass()
    {
        bool negated = PeekAscii() == '^';
        if (negated)
        {
            _index += 1;
        }

        var items = new List<KajayCharacterClassItem>();
        while (_index < _source.Length && PeekAscii() != ']')
        {
            KajayCharacterClassItem? start = ParseClassItem();
            if (start is null)
            {
                return FailedClass();
            }

            if (PeekAscii() != '-')
            {
                items.Add(start);
                continue;
            }

            _index += 1;
            KajayCharacterClassItem? end = ParseClassItem();
            if (start is not KajayCharacterClassItem.Range first
                || first.First != first.Last
                || end is not KajayCharacterClassItem.Range last
                || last.First != last.Last
                || last.First < first.First)
            {
                return FailedClass();
            }

            items.Add(new KajayCharacterClassItem.Range(first.First, last.First));
        }

        if (items.Count == 0 || !TakeAscii(']'))
        {
            return FailedClass();
        }

        return new KajayScalarPattern.CharacterClass(negated, items);
    }

    private KajayCharacterClassItem? ParseClassItem()
    {
        if (PeekAscii() is ']' or '-')
        {
            return null;
        }

        if (PeekAscii() != '\\')
        {
            int? scalar = TakeScalar();
            return scalar is null
                ? null
                : new KajayCharacterClassItem.Range(scalar.Value, scalar.Value);
        }

        _index += 1;
        KajayScalarPattern? escaped = ParseEscape();
        return escaped switch
        {
            KajayScalarPattern.Shorthand shorthand =>
                new KajayCharacterClassItem.Shorthand(shorthand.Name),
            KajayScalarPattern.Literal literal =>
                new KajayCharacterClassItem.Range(literal.Value, literal.Value),
            _ => null,
        };
    }

    private KajayScalarPattern? ParseEscape()
    {
        int? escaped = TakeScalar();
        if (escaped is null)
        {
            return null;
        }

        if (escaped is 'd' or 'D' or 'w' or 'W' or 's' or 'S')
        {
            return new KajayScalarPattern.Shorthand((char)escaped.Value);
        }

        var rune = new Rune(escaped.Value);
        return Rune.IsLetterOrDigit(rune)
            ? null
            : new KajayScalarPattern.Literal(escaped.Value);
    }

    private KajayPatternNode ParseQuantifier(KajayPatternNode item)
    {
        char? current = PeekAscii();
        if (current is '*' or '+' or '?')
        {
            _index += 1;
            return new KajayPatternNode.Repeat(
                item,
                current == '+' ? 1 : 0,
                current is '*' or '+' ? null : 1);
        }

        if (current != '{')
        {
            return item;
        }

        _index += 1;
        int? minimum = ParseDecimal();
        if (minimum is null)
        {
            return Fail();
        }

        int maximum = minimum.Value;
        if (PeekAscii() == ',')
        {
            _index += 1;
            maximum = ParseDecimal() ?? -1;
        }

        if (!TakeAscii('}') || maximum < minimum || maximum > MaxRepetition)
        {
            return Fail();
        }

        return new KajayPatternNode.Repeat(item, minimum.Value, maximum);
    }

}
