namespace Kajay;

internal sealed record DependencyPlan(
    IReadOnlyList<string> Order,
    IReadOnlyList<DependencyError> Errors);
