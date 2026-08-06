namespace Kajay;

internal sealed class SurveyTriggerState(SurveyRuntimeTrigger definition)
{
    internal SurveyRuntimeTrigger Definition { get; } = definition;

    internal bool IsEstablished { get; set; }

    internal bool WasTrue { get; set; }
}
