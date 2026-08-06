namespace Kajay.Expressions.Patterns;

internal abstract record KajayPatternNode
{
    internal sealed record Empty : KajayPatternNode;

    internal sealed record Sequence(
        IReadOnlyList<KajayPatternNode> Items) : KajayPatternNode;

    internal sealed record Alternation(
        IReadOnlyList<KajayPatternNode> Alternatives) : KajayPatternNode;

    internal sealed record Scalar(KajayScalarPattern Pattern) : KajayPatternNode;

    internal sealed record Anchor(bool IsStart) : KajayPatternNode;

    internal sealed record Repeat(
        KajayPatternNode Item,
        int Minimum,
        int? Maximum) : KajayPatternNode;
}

internal abstract record KajayScalarPattern
{
    internal sealed record Literal(int Value) : KajayScalarPattern;

    internal sealed record Dot : KajayScalarPattern;

    internal sealed record Shorthand(char Name) : KajayScalarPattern;

    internal sealed record CharacterClass(
        bool Negated,
        IReadOnlyList<KajayCharacterClassItem> Items) : KajayScalarPattern;
}

internal abstract record KajayCharacterClassItem
{
    internal sealed record Range(int First, int Last) : KajayCharacterClassItem;

    internal sealed record Shorthand(char Name) : KajayCharacterClassItem;
}
