namespace Kajay.Runtime;

/// <summary>How much of one question the respondent got right.</summary>
/// <param name="Earned">Marks earned, never below zero.</param>
/// <param name="Possible">Marks the question was worth.</param>
/// <remarks>
/// A pair rather than a boolean because a multi-select is several decisions wearing one
/// question: collapsing eight tick boxes to a single mark throws away the difference
/// between nearly right and entirely wrong, which is the difference a quiz exists to
/// measure. Arithmetic over values only, so a question can score itself without reaching
/// for the survey it lives in.
/// </remarks>
internal readonly record struct AnswerScore(double Earned, double Possible)
{
    /// <summary>One question, one mark. The rule for every answer that is a single value.</summary>
    /// <param name="value">The response.</param>
    /// <param name="correctAnswer">The authored answer that scores.</param>
    /// <returns>One mark when the two are equal.</returns>
    internal static AnswerScore Single(KajayValue value, KajayValue correctAnswer)
    {
        return new AnswerScore(KajayExpressionEquality.Equals(value, correctAnswer) ? 1 : 0, 1);
    }

    /// <summary>
    /// A mark per expected choice, less one for every choice that should not be there.
    /// </summary>
    /// <param name="selected">What the respondent ticked.</param>
    /// <param name="expected">The choices that score.</param>
    /// <returns>Marks earned out of the number of expected choices.</returns>
    /// <remarks>
    /// The subtraction is the whole design. Counting only matches would give full marks
    /// for ticking every box, turning a partial-credit question into a free one; scoring
    /// per offered choice would give a respondent who answered nothing most of the marks
    /// on a question with three right answers out of eight. Rewarding the right choices
    /// and charging for the wrong ones is the only arrangement where the best strategy is
    /// to answer honestly. Floored at zero, because a question is worth no marks at its
    /// worst and taking marks from elsewhere is not something a quiz may do silently.
    /// </remarks>
    internal static AnswerScore Selection(
        IReadOnlyList<KajayValue> selected,
        IReadOnlyList<KajayValue> expected)
    {
        int matched = expected.Count(choice =>
            selected.Any(chosen => KajayExpressionEquality.Equals(chosen, choice)));
        int spurious = selected.Count(chosen =>
            !expected.Any(choice => KajayExpressionEquality.Equals(chosen, choice)));
        return new AnswerScore(Math.Max(0, matched - spurious), expected.Count);
    }
}
