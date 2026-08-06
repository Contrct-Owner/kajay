namespace Kajay.Expressions;

internal readonly record struct ExpressionPathSegment
{
    private ExpressionPathSegment(string? name, int index, bool isIndex)
    {
        Name = name;
        Index = index;
        IsIndex = isIndex;
    }

    internal string? Name { get; }

    internal int Index { get; }

    internal bool IsIndex { get; }

    internal static ExpressionPathSegment FromName(string name)
    {
        return new ExpressionPathSegment(name, 0, false);
    }

    internal static ExpressionPathSegment FromIndex(int index)
    {
        return new ExpressionPathSegment(null, index, true);
    }
}
