namespace Kajay;

internal sealed record DependencyError(
    string Code,
    IReadOnlyList<string> Nodes);
