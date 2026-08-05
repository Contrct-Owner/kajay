namespace Kajay;

/// <summary>The parsed expression, when valid, and all syntax errors.</summary>
/// <param name="Expression">The parsed expression, or <see langword="null"/> when invalid.</param>
/// <param name="Errors">Errors in deterministic source order.</param>
public sealed record ExpressionParseResult(
    SurveyExpression? Expression,
    IReadOnlyList<ExpressionError> Errors);
