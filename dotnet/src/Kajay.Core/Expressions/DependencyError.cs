namespace Kajay.Expressions;

internal sealed record DependencyError(
    string Code,
    IReadOnlyList<string> Nodes);
