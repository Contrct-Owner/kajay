namespace Kajay;

/// <summary>Describes one committed expression-derived state change.</summary>
public sealed class SurveyElementStateChangedEventArgs : EventArgs
{
    internal SurveyElementStateChangedEventArgs(
        string name,
        SurveyElementKind elementKind,
        SurveyConditionKind conditionKind,
        bool value)
    {
        Name = name;
        ElementKind = elementKind;
        ConditionKind = conditionKind;
        Value = value;
    }

    /// <summary>Gets the exact authored element name.</summary>
    public string Name { get; }

    /// <summary>Gets the kind of definition object that changed.</summary>
    public SurveyElementKind ElementKind { get; }

    /// <summary>Gets the computed state that changed.</summary>
    public SurveyConditionKind ConditionKind { get; }

    /// <summary>Gets the new computed state.</summary>
    public bool Value { get; }
}
