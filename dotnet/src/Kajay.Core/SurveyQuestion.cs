namespace Kajay;

/// <summary>A headless question bound to one mutable survey instance.</summary>
public abstract class SurveyQuestion
{
    private readonly Survey _survey;

    internal SurveyQuestion(Survey survey, SurveyRuntimeQuestion definition)
    {
        _survey = survey;
        Definition = definition;
    }

    internal SurveyRuntimeQuestion Definition { get; }

    /// <summary>Gets the stable registered question type.</summary>
    public string Type => Definition.Type;

    /// <summary>Gets the exact authored question name.</summary>
    public string Name => Definition.Name;

    /// <summary>Gets the response key, which may be shared through <c>valueName</c>.</summary>
    public string ValueName => Definition.ValueKey;

    /// <summary>Gets the current answer, or <see cref="KajayValue.Absent"/>.</summary>
    public KajayValue Value => _survey.GetValue(ValueName);

    /// <summary>Gets the current condition-derived state.</summary>
    public SurveyQuestionState State => _survey.TryGetQuestionState(Name, out SurveyQuestionState state)
        ? state
        : default;

    /// <summary>Sets this question's response value.</summary>
    /// <param name="value">The closed-algebra value to store.</param>
    public void SetValue(KajayValue value)
    {
        _survey.SetValue(ValueName, value);
    }

    /// <summary>Removes this question's response value.</summary>
    public void Clear()
    {
        SetValue(KajayValue.Absent);
    }
}
