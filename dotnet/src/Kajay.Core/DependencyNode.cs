namespace Kajay;

internal sealed record DependencyNode(
    string Key,
    IReadOnlyList<DependencyPattern> Reads,
    ExpressionPath? Writes = null);
