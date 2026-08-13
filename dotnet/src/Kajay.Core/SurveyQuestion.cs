namespace Kajay;

/// <summary>A headless question bound to one mutable survey instance.</summary>
public abstract class SurveyQuestion
{
    private readonly Survey _survey;
    private Func<string, KajayValue>? _readScoped;
    private Action<string, KajayValue>? _writeScoped;

    internal SurveyQuestion(Survey survey, SurveyRuntimeQuestion definition)
    {
        _survey = survey;
        Definition = definition;
    }

    /// <summary>Initializes a host-defined question from its registered factory context.</summary>
    /// <param name="context">The context supplied to the registered factory.</param>
    protected SurveyQuestion(SurveyQuestionFactoryContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        _survey = context.Survey;
        Definition = context.Definition;
    }

    internal SurveyRuntimeQuestion Definition { get; }

    internal Survey Owner => _survey;

    /// <summary>Gets the stable registered question type.</summary>
    public string Type => Definition.Type;

    /// <summary>Gets the exact authored question name.</summary>
    public string Name => Definition.Name;

    /// <summary>Gets the response key, which may be shared through <c>valueName</c>.</summary>
    public string ValueName => Definition.ValueKey;

    /// <summary>Gets the title resolved for the survey's current locale.</summary>
    public string Title
    {
        get
        {
            string title = _survey.ResolveText(Definition.Title);
            return title.Length > 0 ? title : Name;
        }
    }

    /// <summary>Gets the description resolved for the survey's current locale.</summary>
    public string Description => _survey.ResolveText(Definition.Description);

    /// <summary>Gets the authored required-answer message in the current locale.</summary>
    public string RequiredMessage => _survey.ResolveText(Definition.RequiredMessage);

    /// <summary>Gets the current answer, or <see cref="KajayValue.Absent"/>.</summary>
    public KajayValue Value => _readScoped is null
        ? _survey.GetValue(ValueName)
        : _readScoped(ValueName);

    /// <summary>Gets the marks this answer earns, out of the marks it could.</summary>
    /// <returns>Earned and possible marks for this question.</returns>
    /// <remarks>
    /// Virtual because what "right" means belongs to the question type: one value compared
    /// with one value here, and a choice-by-choice reckoning where an answer is a set. A
    /// scorer that lived outside the model would grow a case per type instead.
    /// </remarks>
    /// <summary>Gets whether this question is graded at all.</summary>
    /// <remarks>
    /// Virtual because membership can belong to the parts rather than the whole: a
    /// fill-in-the-blank is marked when any of its blanks is, and the question-level answer
    /// it inherits means nothing there.
    /// </remarks>
    internal virtual bool IsMarked => Definition.HasCorrectAnswer;

    internal virtual AnswerScore ScoreAnswer()
    {
        return AnswerScore.Single(
            Value,
            Definition.CorrectAnswer,
            Definition.Trim,
            Definition.CaseSensitive);
    }

    /// <summary>Gets the current condition-derived state.</summary>
    public SurveyQuestionState State => _survey.TryGetQuestionState(Name, out SurveyQuestionState state)
        ? state
        : default;

    /// <summary>Sets this question's response value.</summary>
    /// <param name="value">The closed-algebra value to store.</param>
    public void SetValue(KajayValue value)
    {
        if (_writeScoped is null)
        {
            _survey.SetValue(ValueName, value);
            return;
        }

        _writeScoped(ValueName, value);
    }

    /// <summary>Binds this question's answer inside another question's, rather than beside it.</summary>
    /// <param name="read">Reads this question's answer from its owner.</param>
    /// <param name="write">Writes this question's answer into its owner.</param>
    /// <remarks>
    /// What a fill-in-the-blank's blanks need: they are real questions, and without this a
    /// blank would quietly own a top-level answer of its own name. Every read and every
    /// write already funnels through this class, so scoping is these two hooks and nothing
    /// else — the same seam the TypeScript runtime calls a value host.
    /// </remarks>
    internal void AttachValueScope(Func<string, KajayValue> read, Action<string, KajayValue> write)
    {
        _readScoped = read;
        _writeScoped = write;
    }

    /// <summary>Removes this question's response value.</summary>
    public void Clear()
    {
        SetValue(KajayValue.Absent);
    }
}
