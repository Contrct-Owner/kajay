namespace Kajay;

/// <summary>A question whose authored values form a selectable set or ordered list.</summary>
public sealed class SurveyChoiceQuestion : SurveyQuestion
{
    private IReadOnlyList<SurveyChoiceItem>? _runtimeChoices;
    private SurveyChoicePager? _choicePager;

    internal SurveyChoiceQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    /// <summary>Gets the effective values in stable source order.</summary>
    public IReadOnlyList<KajayValue> Choices => Array.AsReadOnly(
        ChoiceItems.Select(item => item.Value).ToArray());

    /// <summary>Gets the effective values and display text in stable source order.</summary>
    public IReadOnlyList<SurveyChoiceItem> ChoiceItems =>
        _runtimeChoices ?? ResolveAuthoredChoices();

    /// <summary>Gets the list written in the definition, ignoring any runtime source.</summary>
    public IReadOnlyList<SurveyChoiceItem> AuthoredChoiceItems => ResolveAuthoredChoices();

    /// <summary>Gets whether this question receives server-filtered pages from its host.</summary>
    public bool IsPaged => _choicePager is not null;

    /// <summary>Gets whether the current page request is still running.</summary>
    public bool IsLoadingChoices => _choicePager?.IsLoading ?? false;

    /// <summary>Gets whether the host reports that another choice page exists.</summary>
    public bool HasMoreChoices => _choicePager?.HasMore ?? false;

    /// <summary>Gets the current trimmed server-side filter.</summary>
    public string ChoiceFilter => _choicePager?.Filter ?? string.Empty;

    /// <summary>Gets whether the response is an ordered array rather than one scalar.</summary>
    public bool AllowsMultiple => Type is "checkbox" or "tagbox" or "ranking";

    /// <summary>Gets the marks this answer earns, choice by choice where it is a set.</summary>
    /// <returns>Earned and possible marks for this question.</returns>
    /// <remarks>
    /// <para>
    /// Checkbox and tagbox only, deliberately — not every question <see cref="AllowsMultiple"/>
    /// is true for. A ranking's answer is an ordered array whose *order* is the response, so
    /// a mark per member would score a respondent who listed the right items backwards as
    /// entirely correct. It keeps the whole-answer comparison, which is also what the
    /// TypeScript runtime does: `RankingQuestion` extends the select base rather than the
    /// multi-select one.
    /// </para>
    /// <para>
    /// A lone expected value is read as a list of one rather than falling through to the
    /// base comparison, which would measure an array against a scalar and mark every
    /// respondent wrong.
    /// </para>
    /// </remarks>
    internal override AnswerScore ScoreAnswer()
    {
        if (Type is not ("checkbox" or "tagbox"))
        {
            return base.ScoreAnswer();
        }

        KajayValue expected = Definition.CorrectAnswer;
        IReadOnlyList<KajayValue> wanted = expected.Kind == KajayValueKind.Array
            ? expected.GetArray()
            : [expected];
        IReadOnlyList<KajayValue> selected = Value.Kind == KajayValueKind.Array
            ? Value.GetArray()
            : [];
        return AnswerScore.Selection(selected, wanted);
    }

    /// <summary>Reports whether the current response contains an authored choice.</summary>
    /// <param name="choice">A value matched with Kajay equality.</param>
    /// <returns>True when selected.</returns>
    public bool IsSelected(KajayValue choice)
    {
        KajayValue resolved = Resolve(choice);
        return AllowsMultiple
            ? Value.Kind == KajayValueKind.Array
                && Value.GetArray().Any(item => KajayExpressionEquality.Equals(item, resolved))
            : KajayExpressionEquality.Equals(Value, resolved);
    }

    /// <summary>Selects one authored value without duplicating an existing selection.</summary>
    /// <param name="choice">A value matched with Kajay equality.</param>
    public void Select(KajayValue choice)
    {
        KajayValue resolved = Resolve(choice);
        if (!AllowsMultiple)
        {
            SetValue(resolved);
            return;
        }

        List<KajayValue> selected = Value.Kind == KajayValueKind.Array
            ? Value.GetArray().ToList()
            : [];
        if (!selected.Any(item => KajayExpressionEquality.Equals(item, resolved)))
        {
            selected.Add(resolved);
            SetValue(KajayValue.FromArray(selected));
        }
    }

    /// <summary>Removes one selected value and removes an empty array response.</summary>
    /// <param name="choice">A value matched with Kajay equality.</param>
    public void Deselect(KajayValue choice)
    {
        KajayValue resolved = Resolve(choice);
        if (!AllowsMultiple)
        {
            if (KajayExpressionEquality.Equals(Value, resolved))
            {
                Clear();
            }

            return;
        }

        if (Value.Kind != KajayValueKind.Array)
        {
            return;
        }

        KajayValue[] remaining = Value.GetArray()
            .Where(item => !KajayExpressionEquality.Equals(item, resolved))
            .ToArray();
        SetValue(remaining.Length == 0 ? KajayValue.Absent : KajayValue.FromArray(remaining));
    }

    /// <summary>Replaces a multiple-choice or ranking response in caller-supplied order.</summary>
    /// <param name="choices">Authored values matched with Kajay equality.</param>
    public void SetSelection(IEnumerable<KajayValue> choices)
    {
        ArgumentNullException.ThrowIfNull(choices);
        if (!AllowsMultiple)
        {
            throw new InvalidOperationException($"Question '{Name}' accepts one choice.");
        }

        var selected = new List<KajayValue>();
        foreach (KajayValue choice in choices)
        {
            KajayValue resolved = Resolve(choice);
            if (!selected.Any(item => KajayExpressionEquality.Equals(item, resolved)))
            {
                selected.Add(resolved);
            }
        }

        SetValue(selected.Count == 0 ? KajayValue.Absent : KajayValue.FromArray(selected));
    }

    /// <summary>Loads and appends the next host-provided choice page.</summary>
    /// <param name="cancellationToken">Cancels the host operation.</param>
    public Task LoadMoreChoicesAsync(CancellationToken cancellationToken = default)
    {
        return _choicePager?.LoadMoreAsync(cancellationToken) ?? Task.CompletedTask;
    }

    /// <summary>Replaces the server-side filter and loads its first page.</summary>
    /// <param name="filter">The filter, trimmed before it reaches the host.</param>
    /// <param name="cancellationToken">Cancels the host operation.</param>
    public Task SetChoiceFilterAsync(
        string filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);
        return _choicePager?.SetFilterAsync(filter, cancellationToken) ?? Task.CompletedTask;
    }

    internal SurveyRuntimeChoiceSettings ChoiceSettings => Definition.ChoiceSettings
        ?? throw new InvalidOperationException($"Question '{Name}' has no choice settings.");

    internal void AttachChoicePager(SurveyChoicePager pager)
    {
        _choicePager = pager;
        _runtimeChoices = Array.Empty<SurveyChoiceItem>();
    }

    internal bool SetChoices(IReadOnlyList<SurveyChoiceItem> choices)
    {
        if (_runtimeChoices is not null && _runtimeChoices.SequenceEqual(choices))
        {
            return false;
        }

        _runtimeChoices = Array.AsReadOnly(choices.ToArray());
        return true;
    }

    internal bool ResetChoices()
    {
        if (_runtimeChoices is null)
        {
            return false;
        }

        _runtimeChoices = null;
        return true;
    }

    private KajayValue Resolve(KajayValue choice)
    {
        foreach (KajayValue authored in Choices)
        {
            if (KajayExpressionEquality.Equals(authored, choice))
            {
                return authored;
            }
        }

        throw new ArgumentException(
            $"Value is not an authored choice for question '{Name}'.",
            nameof(choice));
    }

    private System.Collections.ObjectModel.ReadOnlyCollection<SurveyChoiceItem>
        ResolveAuthoredChoices()
    {
        return Array.AsReadOnly(Definition.ChoiceItems
            .Select(item => new SurveyChoiceItem(item.Value, Owner.ResolveText(item.Text)))
            .ToArray());
    }
}
