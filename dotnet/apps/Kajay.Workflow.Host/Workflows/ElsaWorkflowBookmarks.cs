namespace Kajay.Workflow.Host.Workflows;

internal static class ElsaWorkflowBookmarks
{
    internal static string Survey(string stepKey)
    {
        return $"kajay:survey:{stepKey}";
    }

    internal static string Effect(string stepKey)
    {
        return $"kajay:effect:{stepKey}";
    }

    internal static string Review(string stepKey)
    {
        return $"kajay:review:{stepKey}";
    }
}
