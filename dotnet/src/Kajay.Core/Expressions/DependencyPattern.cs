namespace Kajay.Expressions;

internal sealed record DependencyPattern(IReadOnlyList<DependencyPatternSegment> Segments)
{
    internal static DependencyPattern Exact(ExpressionPath path)
    {
        return new DependencyPattern(
            path.Segments.Select(DependencyPatternSegment.FromPath).ToArray());
    }

    internal static DependencyPattern GeneralizeIndices(ExpressionPath path)
    {
        return new DependencyPattern(
            path.Segments
                .Select(segment => segment.IsIndex
                    ? DependencyPatternSegment.AnyIndex
                    : DependencyPatternSegment.FromPath(segment))
                .ToArray());
    }

    internal bool Overlaps(ExpressionPath path)
    {
        int shared = Math.Min(path.Segments.Count, Segments.Count);
        if (shared == 0)
        {
            return false;
        }

        for (int index = 0; index < shared; index += 1)
        {
            ExpressionPathSegment pathSegment = path.Segments[index];
            DependencyPatternSegment patternSegment = Segments[index];
            if (patternSegment.IsAnyIndex)
            {
                if (!pathSegment.IsIndex)
                {
                    return false;
                }

                continue;
            }

            if (pathSegment != patternSegment.PathSegment)
            {
                return false;
            }
        }

        return true;
    }

    internal string? RootName => Segments.Count > 0
        && !Segments[0].IsAnyIndex
        && !Segments[0].PathSegment.IsIndex
            ? Segments[0].PathSegment.Name
            : null;
}
