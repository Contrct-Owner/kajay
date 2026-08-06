namespace Kajay.Workflow.Host.Delivery;

internal sealed class WorkflowWorkerOptions
{
    internal const string SectionName = "WorkflowWorkers";

    public bool Enabled { get; set; } = true;

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(1);

    public TimeSpan LeaseDuration { get; set; } = TimeSpan.FromSeconds(30);

    public int MaximumAttempts { get; set; } = 8;

    public int BatchSize { get; set; } = 10;
}
