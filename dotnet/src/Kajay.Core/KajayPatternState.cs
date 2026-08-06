namespace Kajay;

internal abstract class KajayPatternState;

internal sealed class KajayAcceptState : KajayPatternState;

internal sealed class KajayMatchState(
    KajayScalarPattern pattern,
    KajayPatternState next) : KajayPatternState
{
    public KajayScalarPattern Pattern { get; } = pattern;

    public KajayPatternState Next { get; } = next;
}

internal sealed class KajayBranchState(
    KajayPatternState? first,
    KajayPatternState second) : KajayPatternState
{
    public KajayPatternState? First { get; set; } = first;

    public KajayPatternState Second { get; } = second;
}

internal sealed class KajayAnchorState(
    bool isStart,
    KajayPatternState next) : KajayPatternState
{
    public bool IsStart { get; } = isStart;

    public KajayPatternState Next { get; } = next;
}
