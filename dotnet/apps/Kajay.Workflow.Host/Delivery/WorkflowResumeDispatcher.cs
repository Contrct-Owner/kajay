using Microsoft.Extensions.Options;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class WorkflowResumeDispatcher(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    IOptions<WorkflowWorkerOptions> options,
    ILogger<WorkflowResumeDispatcher> logger) : BackgroundService
{
    private static readonly Action<ILogger, Guid, Exception?> ResumeFailed =
        LoggerMessage.Define<Guid>(
            LogLevel.Warning,
            new EventId(1, nameof(ResumeFailed)),
            "Workflow resume {ResumeId} failed");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            int processed = await ProcessBatchAsync(stoppingToken).ConfigureAwait(false);
            if (processed == 0)
            {
                await Task.Delay(options.Value.PollInterval, timeProvider, stoppingToken)
                    .ConfigureAwait(false);
            }
        }
    }

    private async Task<int> ProcessBatchAsync(CancellationToken cancellationToken)
    {
        IReadOnlyList<WorkflowResumeLease> claimed;
        await using (AsyncServiceScope scope = scopeFactory.CreateAsyncScope())
        {
            claimed = await scope.ServiceProvider.GetRequiredService<WorkflowResumeLeaseStore>()
                .ClaimAsync(cancellationToken).ConfigureAwait(false);
        }
        foreach (WorkflowResumeLease lease in claimed)
        {
            await ProcessAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        return claimed.Count;
    }

    private async Task ProcessAsync(
        WorkflowResumeLease lease,
        CancellationToken cancellationToken)
    {
        try
        {
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<WorkflowResumeProcessor>()
                .ProcessAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            ResumeFailed(logger, lease.RecordId, exception);
        }
    }
}
