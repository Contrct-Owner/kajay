namespace Kajay.Expressions;

/// <summary>Evaluates a cancellation-aware host-defined expression function.</summary>
/// <param name="arguments">Evaluated arguments in source order.</param>
/// <param name="context">Deterministic inputs available to the function.</param>
/// <param name="cancellationToken">Cancels host work that is no longer needed.</param>
/// <returns>A task-like operation producing the function result.</returns>
public delegate ValueTask<KajayValue> AsyncExpressionFunction(
    IReadOnlyList<KajayValue> arguments,
    ExpressionFunctionContext context,
    CancellationToken cancellationToken);
