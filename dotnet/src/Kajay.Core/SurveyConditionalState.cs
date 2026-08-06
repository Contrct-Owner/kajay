namespace Kajay;

internal sealed class SurveyConditionalState(SurveyRuntimeCondition definition)
{
    internal SurveyRuntimeCondition Definition { get; } = definition;

    internal bool IsVisible { get; set; } = true;

    internal bool IsEnabled { get; set; } = true;

    internal bool IsRequired { get; set; } = !definition.HasRequiredCondition
        && definition.AuthoredRequired;
}
