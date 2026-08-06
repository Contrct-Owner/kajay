using System.Diagnostics;
using System.Text;

namespace Kajay;

internal sealed class KajayPattern
{
    private const int MaxInputCodeUnits = 64 * 1_024;
    private readonly KajayPatternState _start;

    private KajayPattern(KajayPatternState start)
    {
        _start = start;
    }

    public static KajayPattern? Compile(string source)
    {
        KajayPatternNode? node = KajayPatternParser.Parse(source);
        if (node is null)
        {
            return null;
        }

        KajayPatternState? start = new KajayPatternCompiler().Compile(node);
        return start is null ? null : new KajayPattern(start);
    }

    public bool IsMatch(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        if (value.Length > MaxInputCodeUnits)
        {
            return false;
        }

        int[] input = value.EnumerateRunes().Select(rune => rune.Value).ToArray();
        HashSet<KajayPatternState> current = Closure([_start], 0, input.Length);
        if (current.Any(state => state is KajayAcceptState))
        {
            return true;
        }

        for (int index = 0; index < input.Length; index += 1)
        {
            var seeds = new List<KajayPatternState> { _start };
            foreach (KajayPatternState state in current)
            {
                if (state is KajayMatchState match
                    && Matches(match.Pattern, input[index]))
                {
                    seeds.Add(match.Next);
                }
            }

            current = Closure(seeds, index + 1, input.Length);
            if (current.Any(state => state is KajayAcceptState))
            {
                return true;
            }
        }

        return false;
    }

    private static HashSet<KajayPatternState> Closure(
        IEnumerable<KajayPatternState> seeds,
        int position,
        int length)
    {
        var reached = new HashSet<KajayPatternState>();
        var pending = new Stack<KajayPatternState>(seeds);
        while (pending.TryPop(out KajayPatternState? state))
        {
            if (!reached.Add(state))
            {
                continue;
            }

            if (state is KajayBranchState branch)
            {
                if (branch.First is not null)
                {
                    pending.Push(branch.First);
                }

                pending.Push(branch.Second);
            }
            else if (state is KajayAnchorState anchor
                && (anchor.IsStart ? position == 0 : position == length))
            {
                pending.Push(anchor.Next);
            }
        }

        return reached;
    }

    private static bool Matches(KajayScalarPattern pattern, int scalar)
    {
        return pattern switch
        {
            KajayScalarPattern.Literal literal => scalar == literal.Value,
            KajayScalarPattern.Dot => scalar is not 0x0a and not 0x0d and not 0x2028 and not 0x2029,
            KajayScalarPattern.Shorthand shorthand => MatchesShorthand(shorthand.Name, scalar),
            KajayScalarPattern.CharacterClass characterClass =>
                characterClass.Negated
                    != characterClass.Items.Any(item => MatchesClassItem(item, scalar)),
            _ => throw new UnreachableException(),
        };
    }

    private static bool MatchesClassItem(KajayCharacterClassItem item, int scalar)
    {
        return item switch
        {
            KajayCharacterClassItem.Range range =>
                scalar >= range.First && scalar <= range.Last,
            KajayCharacterClassItem.Shorthand shorthand =>
                MatchesShorthand(shorthand.Name, scalar),
            _ => throw new UnreachableException(),
        };
    }

    private static bool MatchesShorthand(char name, int scalar)
    {
        char positive = char.ToLowerInvariant(name);
        bool matched = positive switch
        {
            'd' => scalar is >= 0x30 and <= 0x39,
            'w' => scalar is >= 0x30 and <= 0x39
                or >= 0x41 and <= 0x5a
                or >= 0x61 and <= 0x7a
                or 0x5f,
            's' => IsPatternSpace(scalar),
            _ => throw new UnreachableException(),
        };
        return name == positive ? matched : !matched;
    }

    private static bool IsPatternSpace(int scalar)
    {
        return scalar is >= 0x09 and <= 0x0d
            or 0x20 or 0xa0 or 0x1680
            or >= 0x2000 and <= 0x200a
            or 0x2028 or 0x2029 or 0x202f or 0x205f or 0x3000 or 0xfeff;
    }
}
