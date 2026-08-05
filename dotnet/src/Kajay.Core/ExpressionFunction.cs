namespace Kajay;

/// <summary>Evaluates a synchronous host-defined expression function.</summary>
/// <param name="arguments">Evaluated arguments in source order.</param>
/// <param name="context">Deterministic inputs available to the function.</param>
/// <returns>The function result.</returns>
public delegate KajayValue ExpressionFunction(
    IReadOnlyList<KajayValue> arguments,
    ExpressionFunctionContext context);
