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
    /// <param name="trim">Whether surrounding whitespace is ignored when marking by text.</param>
    /// <param name="caseSensitive">Whether case matters when marking by text.</param>
    internal static AnswerScore Single(
        KajayValue value,
        KajayValue correctAnswer,
        bool trim = true,
        bool caseSensitive = false)
    {
        return new AnswerScore(Matches(value, correctAnswer, trim, caseSensitive) ? 1 : 0, 1);
    }

    /// <summary>
    /// Compares as text whenever either side is text, so an authored number marks a typed one.
    /// </summary>
    /// <remarks>
    /// A respondent types into an input and gets text back, so an authored <c>42</c> and a
    /// typed <c>"42"</c> are the same answer. Trimming and case are the author's call and
    /// both default toward forgiving: an assessment marking <c>paris</c> wrong is measuring
    /// typing rather than the subject.
    /// </remarks>
    private static bool Matches(
        KajayValue value,
        KajayValue correctAnswer,
        bool trim,
        bool caseSensitive)
    {
        if (correctAnswer.Kind != KajayValueKind.Text && value.Kind != KajayValueKind.Text)
        {
            return KajayExpressionEquality.Equals(value, correctAnswer);
        }

        return string.Equals(
            Normalize(value, trim),
            Normalize(correctAnswer, trim),
            caseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase);
    }

    private static string Normalize(KajayValue value, bool trim)
    {
        // The runtime's own conversion, not `ToString`: a `KajayValue` is a struct whose
        // default rendering is its type name.
        string text = value.Kind switch
        {
            KajayValueKind.Absent or KajayValueKind.Null => string.Empty,
            KajayValueKind.Text => value.GetString(),
            _ => KajayText.TryConvert(value, out string converted) ? converted : string.Empty,
        };
        return trim ? text.Trim() : text;
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
