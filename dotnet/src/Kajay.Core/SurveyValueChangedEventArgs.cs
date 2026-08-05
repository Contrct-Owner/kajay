namespace Kajay;

/// <summary>Provides one committed answer change.</summary>
public sealed class SurveyValueChangedEventArgs : EventArgs
{
    internal SurveyValueChangedEventArgs(
        string name,
        KajayValue previousValue,
        KajayValue value)
    {
        Name = name;
        PreviousValue = previousValue;
        Value = value;
    }

    /// <summary>Gets the exact answer name.</summary>
    public string Name { get; }

    /// <summary>Gets the previous value, or absent when the answer did not exist.</summary>
    public KajayValue PreviousValue { get; }

    /// <summary>Gets the new value, or absent when the answer was removed.</summary>
    public KajayValue Value { get; }
}
