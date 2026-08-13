using System.Collections.ObjectModel;

namespace Kajay;

/// <summary>A sentence with gaps the respondent types into.</summary>
/// <remarks>
/// The prose is what makes this a type rather than a composition: several named fields
/// under one name already exist, and so does arbitrary markup. Neither can put an input
/// <em>inside</em> a sentence, and being inside the sentence is the whole question — the
/// surrounding words are what is being asked.
/// </remarks>
public sealed class SurveyFillInTheBlankQuestion : SurveyQuestion
{
    internal SurveyFillInTheBlankQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    private SurveyRuntimeBlankSettings Settings => Definition.BlankSettings!;

    /// <summary>Gets the prose for the current locale, with its markers intact.</summary>
    public string Template => Settings.Template.Resolve(Owner.Locale);

    /// <summary>Gets the prose split into what is drawn: text, then a gap, then more text.</summary>
    /// <remarks>
    /// Computed on read rather than cached, because the template is localizable — switching
    /// locale replaces the sentence, and a cached split would draw the previous language's
    /// gaps in the new language's words.
    /// </remarks>
    public IReadOnlyList<BlankSegment> Segments => BlankTemplate.Parse(Template);

    /// <summary>Gets the names this question declares, in authored order.</summary>
    public IReadOnlyList<string> BlankNames =>
        Array.AsReadOnly(Settings.Blanks.Select(blank => blank.Name).ToArray());

    /// <summary>Gets what a screen reader calls one blank, falling back to its name.</summary>
    /// <param name="name">The exact ordinal blank name.</param>
    /// <returns>The label, or the name when none was authored.</returns>
    /// <remarks>
    /// Load-bearing rather than decorative: the sentence labels a blank visually and not
    /// programmatically, so without this a reader announces "edit text, blank".
    /// </remarks>
    public string GetBlankLabel(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        SurveyRuntimeBlank? blank = Find(name);
        if (blank is null)
        {
            return name;
        }

        string label = blank.Label.Resolve(Owner.Locale);
        return label.Length > 0 ? label : blank.Name;
    }

    /// <summary>Gets one blank's answer.</summary>
    /// <param name="name">The exact ordinal blank name.</param>
    /// <returns>The stored answer, or absent.</returns>
    public KajayValue GetBlankValue(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return Value.Kind == KajayValueKind.Map
            && Value.GetObject().TryGetValue(name, out KajayValue value)
            ? value
            : KajayValue.Absent;
    }

    /// <summary>Records one blank's answer, dropping blanks left empty.</summary>
    /// <param name="name">The exact ordinal blank name.</param>
    /// <param name="value">The answer; absent removes it.</param>
    /// <remarks>
    /// An object with nothing left in it becomes absent rather than empty, because an empty
    /// map is not empty by any test the engine applies — a required question would be
    /// satisfied by a sentence nobody filled in.
    /// </remarks>
    public void SetBlankValue(string name, KajayValue value)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        Dictionary<string, KajayValue> next = Value.Kind == KajayValueKind.Map
            ? new Dictionary<string, KajayValue>(Value.GetObject(), StringComparer.Ordinal)
            : new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        next[name] = value;
        Dictionary<string, KajayValue> filled = next
            .Where(entry => entry.Value.Kind != KajayValueKind.Absent
                && !(entry.Value.Kind == KajayValueKind.Text && entry.Value.GetString().Length == 0))
            .ToDictionary(entry => entry.Key, entry => entry.Value, StringComparer.Ordinal);
        Owner.SetValue(
            ValueName,
            filled.Count > 0 ? KajayValue.FromObject(filled) : KajayValue.Absent);
    }

    /// <summary>Gets whether this sentence is graded at all.</summary>
    /// <remarks>
    /// Asked of the blanks. This type inherits a question-level correct answer it never
    /// uses, so reading that would leave a fully marked sentence out of the quiz because
    /// nobody wrote an answer at a level that means nothing here.
    /// </remarks>
    internal override bool IsMarked => Settings.Blanks.Any(blank => blank.HasCorrectAnswer);

    /// <summary>Gets a mark per marked blank.</summary>
    /// <returns>Earned and possible marks for this sentence.</returns>
    /// <remarks>
    /// Partial credit falls out of the score being a pair: a sentence with four gaps is four
    /// decisions wearing one question. Only blanks carrying a correct answer count toward
    /// the total, so an author may mark two gaps and leave a third for prose.
    /// </remarks>
    internal override AnswerScore ScoreAnswer()
    {
        SurveyRuntimeBlank[] marked = Settings.Blanks.Where(blank => blank.HasCorrectAnswer).ToArray();
        int earned = marked.Count(blank => Matches(GetBlankValue(blank.Name), blank));
        return new AnswerScore(earned, marked.Length);
    }

    /// <summary>
    /// Compares as text whenever either side is text, so an authored number marks a typed one.
    /// </summary>
    private static bool Matches(KajayValue value, SurveyRuntimeBlank blank)
    {
        if (blank.CorrectAnswer.Kind != KajayValueKind.Text && value.Kind != KajayValueKind.Text)
        {
            return KajayExpressionEquality.Equals(value, blank.CorrectAnswer);
        }

        return string.Equals(
            Normalize(value, blank),
            Normalize(blank.CorrectAnswer, blank),
            blank.CaseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase);
    }

    private static string Normalize(KajayValue value, SurveyRuntimeBlank blank)
    {
        // The runtime's own conversion, not `ToString`: a `KajayValue` is a struct whose
        // default rendering is its type name, and the contract already fixes how a number
        // becomes text — an assessment must not invent a second answer to that.
        string text = value.Kind switch
        {
            KajayValueKind.Absent or KajayValueKind.Null => string.Empty,
            KajayValueKind.Text => value.GetString(),
            _ => KajayText.TryConvert(value, out string converted) ? converted : string.Empty,
        };
        return blank.Trim ? text.Trim() : text;
    }

    private SurveyRuntimeBlank? Find(string name)
    {
        return Settings.Blanks.FirstOrDefault(blank =>
            string.Equals(blank.Name, name, StringComparison.Ordinal));
    }
}
