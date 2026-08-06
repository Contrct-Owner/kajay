namespace Kajay.Expressions;

/// <summary>A zero-based half-open range of UTF-16 code units.</summary>
/// <param name="Start">The inclusive start offset.</param>
/// <param name="End">The exclusive end offset.</param>
public readonly record struct TextSpan(int Start, int End);
