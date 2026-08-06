using System.Diagnostics;

namespace Kajay;

internal sealed class KajayPatternCompiler
{
    private const int MaxCompiledStates = 4_096;
    private int _stateCount;

    public KajayPatternState? Compile(KajayPatternNode node)
    {
        try
        {
            return Compile(node, Create(new KajayAcceptState()));
        }
        catch (PatternLimitException)
        {
            return null;
        }
    }

    private KajayPatternState Compile(
        KajayPatternNode node,
        KajayPatternState next)
    {
        return node switch
        {
            KajayPatternNode.Empty => next,
            KajayPatternNode.Scalar scalar =>
                Create(new KajayMatchState(scalar.Pattern, next)),
            KajayPatternNode.Anchor anchor =>
                Create(new KajayAnchorState(anchor.IsStart, next)),
            KajayPatternNode.Sequence sequence => CompileSequence(sequence, next),
            KajayPatternNode.Alternation alternation => CompileAlternation(alternation, next),
            KajayPatternNode.Repeat repeat => CompileRepeat(repeat, next),
            _ => throw new UnreachableException(),
        };
    }

    private KajayPatternState CompileSequence(
        KajayPatternNode.Sequence sequence,
        KajayPatternState next)
    {
        KajayPatternState start = next;
        for (int index = sequence.Items.Count - 1; index >= 0; index -= 1)
        {
            start = Compile(sequence.Items[index], start);
        }

        return start;
    }

    private KajayPatternState CompileAlternation(
        KajayPatternNode.Alternation alternation,
        KajayPatternState next)
    {
        int last = alternation.Alternatives.Count - 1;
        KajayPatternState start = Compile(alternation.Alternatives[last], next);
        for (int index = last - 1; index >= 0; index -= 1)
        {
            start = Create(new KajayBranchState(
                Compile(alternation.Alternatives[index], next),
                start));
        }

        return start;
    }

    private KajayPatternState CompileRepeat(
        KajayPatternNode.Repeat repeat,
        KajayPatternState next)
    {
        KajayPatternState start = next;
        if (repeat.Maximum is null)
        {
            var branch = Create(new KajayBranchState(null, next));
            branch.First = Compile(repeat.Item, branch);
            start = branch;
        }
        else
        {
            for (int count = repeat.Maximum.Value; count > repeat.Minimum; count -= 1)
            {
                KajayPatternState optional = Compile(repeat.Item, start);
                start = Create(new KajayBranchState(optional, start));
            }
        }

        for (int count = 0; count < repeat.Minimum; count += 1)
        {
            start = Compile(repeat.Item, start);
        }

        return start;
    }

    private T Create<T>(T state)
        where T : KajayPatternState
    {
        _stateCount += 1;
        if (_stateCount > MaxCompiledStates)
        {
            throw new PatternLimitException();
        }

        return state;
    }

    private sealed class PatternLimitException : Exception;
}
