namespace Kajay;

/// <summary>One selectable value and the text a host should display for it.</summary>
/// <param name="Value">The closed Kajay value stored in the answer.</param>
/// <param name="Text">The display text.</param>
public sealed record SurveyChoiceItem(KajayValue Value, string Text);
