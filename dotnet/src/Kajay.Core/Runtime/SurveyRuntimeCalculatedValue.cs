using System.Text.Json.Nodes;

namespace Kajay.Runtime;

/// <summary>One computed rule: a name, the expression behind it, and where it lands.</summary>
/// <param name="Name">The value's name, or a blank's name inside its sentence.</param>
/// <param name="Expression">The parsed expression, or null when it did not parse.</param>
/// <param name="IncludeIntoResult">Whether the value belongs in the response.</param>
/// <param name="Owner">The answer this value lives inside, or null for a value of its own.</param>
internal sealed record SurveyRuntimeCalculatedValue(
    string Name,
    SurveyExpression? Expression,
    bool IncludeIntoResult,
    string? Owner = null)
{
    /// <summary>Gets the path this rule writes, which is what orders everything reading it.</summary>
    internal ExpressionPath Path => Owner is null
        ? ExpressionPath.FromName(Name)
        : new ExpressionPath(
            [ExpressionPathSegment.FromName(Owner), ExpressionPathSegment.FromName(Name)]);

    internal static SurveyRuntimeCalculatedValue From(JsonObject definition)
    {
        string source = definition["expression"]?.GetValue<string>() ?? string.Empty;
        return new SurveyRuntimeCalculatedValue(
            definition["name"]?.GetValue<string>() ?? string.Empty,
            SurveyExpression.Parse(source).Expression,
            definition["includeIntoResult"]?.GetValue<bool>() ?? false);
    }

    /// <summary>Turns every computed question into the calculated value it already is.</summary>
    /// <param name="question">A question, which may itself position computed blanks.</param>
    /// <param name="owner">The answer a blank writes inside, or null on a page.</param>
    /// <returns>One rule per computed question, including those inside a sentence.</returns>
    /// <remarks>
    /// An expression question holds no respondent input and its value belongs in the response,
    /// which is a calculated value in everything but name. Without this it was built as a plain
    /// scalar with no rule behind it, so it stayed absent for ever and the two runtimes
    /// disagreed about what a survey's data contained.
    /// <para>
    /// A computed blank is the same rule aimed one level in. Its answer really does live at
    /// <c>sentence.blank</c> — that is where every other blank's answer is, and how an
    /// expression elsewhere reads it — so the rule declares that path rather than taking a
    /// top-level name of its own and leaving the sentence empty.
    /// </para>
    /// </remarks>
    internal static IEnumerable<SurveyRuntimeCalculatedValue> ForComputedQuestions(
        SurveyRuntimeQuestion question,
        string? owner = null)
    {
        if (string.Equals(question.Type, "expression", StringComparison.Ordinal))
        {
            string source = question.Properties["expression"]?.GetValue<string>() ?? string.Empty;
            SurveyExpression? expression = SurveyExpression.Parse(source).Expression;
            if (expression is not null)
            {
                yield return new SurveyRuntimeCalculatedValue(
                    owner is null ? question.ValueKey : question.Name,
                    expression,
                    true,
                    owner);
            }
        }

        foreach (SurveyRuntimeQuestion blank in question.BlankSettings?.Blanks ?? [])
        {
            foreach (SurveyRuntimeCalculatedValue rule
                in ForComputedQuestions(blank, question.ValueKey))
            {
                yield return rule;
            }
        }
    }
}
