namespace Kajay.Expressions;

/// <summary>Deterministic inputs supplied to a host-defined expression function.</summary>
/// <param name="Clock">The explicit UTC clock for the current evaluation.</param>
public sealed record ExpressionFunctionContext(DateTimeOffset Clock);
