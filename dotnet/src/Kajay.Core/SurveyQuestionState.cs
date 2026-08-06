namespace Kajay;

/// <summary>Reports the current computed state of one named question.</summary>
/// <param name="IsVisible">Whether the question's own visibility condition holds.</param>
/// <param name="IsEnabled">Whether the question's own enablement condition holds.</param>
/// <param name="IsRequired">Whether the current requiredness rule holds.</param>
/// <param name="IsReachable">Whether the question and all its containers are visible.</param>
public readonly record struct SurveyQuestionState(
    bool IsVisible,
    bool IsEnabled,
    bool IsRequired,
    bool IsReachable);
