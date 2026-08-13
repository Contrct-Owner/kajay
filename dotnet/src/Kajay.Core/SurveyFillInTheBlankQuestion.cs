namespace Kajay;

/// <summary>A sentence with fields in it.</summary>
/// <remarks>
/// The prose is a <em>layout</em>. What sits in it is any question that fits in a line — a
/// text field, a dropdown, a multi-select, a yes/no — so authoring a form here is writing a
/// sentence, and filling in a blank is the simplest case rather than the whole of it.
/// <para>
/// The blanks are real questions, as a matrix's cell columns and a dynamic panel's template
/// elements already are. A dropdown blank <em>is</em> a dropdown, which is what makes its
/// choices, its remote choices and its marking arrive with it.
/// </para>
/// </remarks>
public sealed class SurveyFillInTheBlankQuestion : SurveyQuestion
{
    private readonly IReadOnlyList<SurveyQuestion> _blanks;

    internal SurveyFillInTheBlankQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
        // Bound through this question rather than beside it: a blank reads and writes inside
        // *this* answer, and one pointed at the survey would quietly own a top-level answer
        // of its own name.
        _blanks = Array.AsReadOnly(definition.BlankSettings!.Blanks
            .Select(blank => survey.CreateBlankQuestion(this, blank))
            .ToArray());
    }

    private SurveyRuntimeBlankSettings Settings => Definition.BlankSettings!;

    /// <summary>Gets the prose for the current locale, with its markers intact.</summary>
    public string Template => Settings.Template.Resolve(Owner.Locale);

    /// <summary>Gets the prose split into what is drawn: text, then a field, then more text.</summary>
    /// <remarks>
    /// Computed on read, because the template is localizable — switching locale replaces the
    /// sentence, and a cached split would draw the previous language's gaps in the new
    /// language's words.
    /// </remarks>
    public IReadOnlyList<BlankSegment> Segments => BlankTemplate.Parse(Template);

    /// <summary>Gets the questions this sentence positions, in authored order.</summary>
    public IReadOnlyList<SurveyQuestion> Blanks => _blanks;

    /// <summary>Gets the question a marker refers to, or null when nobody declared it.</summary>
    /// <param name="name">The exact ordinal blank name.</param>
    /// <returns>The bound blank, or null.</returns>
    public SurveyQuestion? GetBlank(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _blanks.FirstOrDefault(blank =>
            string.Equals(blank.Name, name, StringComparison.Ordinal));
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

    /// <summary>Gets whether this sentence is graded at all — asked of the blanks.</summary>
    /// <remarks>
    /// This type inherits a question-level correct answer it never uses, so reading that
    /// would leave a fully marked sentence out of the quiz.
    /// </remarks>
    internal override bool IsMarked => _blanks.Any(blank => blank.IsMarked);

    /// <summary>Gets a mark per marked blank, each scored by its own type.</summary>
    /// <returns>Earned and possible marks for this sentence.</returns>
    /// <remarks>
    /// Partial credit costs nothing of its own: a multi-select blank is scored by the rule a
    /// checkbox uses, because it is one.
    /// </remarks>
    internal override AnswerScore ScoreAnswer()
    {
        return _blanks
            .Where(blank => blank.IsMarked)
            .Select(blank => blank.ScoreAnswer())
            .Aggregate(
                new AnswerScore(0, 0),
                (running, score) => new AnswerScore(
                    running.Earned + score.Earned,
                    running.Possible + score.Possible));
    }
}
