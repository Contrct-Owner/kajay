namespace Kajay;

internal readonly record struct DependencyPatternSegment
{
    private DependencyPatternSegment(ExpressionPathSegment pathSegment, bool isAnyIndex)
    {
        PathSegment = pathSegment;
        IsAnyIndex = isAnyIndex;
    }

    internal ExpressionPathSegment PathSegment { get; }

    internal bool IsAnyIndex { get; }

    internal static DependencyPatternSegment FromPath(ExpressionPathSegment segment)
    {
        return new DependencyPatternSegment(segment, false);
    }

    internal static DependencyPatternSegment AnyIndex { get; } = new(default, true);
}
