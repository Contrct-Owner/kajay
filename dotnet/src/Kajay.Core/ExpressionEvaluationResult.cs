namespace Kajay;

/// <summary>The value and recoverable diagnostics from evaluating an expression.</summary>
/// <param name="Value">The evaluated value, including explicit absence.</param>
/// <param name="Errors">Errors in deterministic evaluation order.</param>
public sealed record ExpressionEvaluationResult(
    KajayValue Value,
    IReadOnlyList<ExpressionError> Errors);
