using Microsoft.Extensions.Options;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class ScheduledActionDispatcher(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    IOptions<WorkflowWorkerOptions> options,
    ILogger<ScheduledActionDispatcher> logger) : BackgroundService
{
    private static readonly Action<ILogger, string, Exception?> ActionFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1, nameof(ActionFailed)),
            "Scheduled workflow action {ActionId} failed");

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
        IReadOnlyList<ScheduledActionLease> leases;
        await using (AsyncServiceScope scope = scopeFactory.CreateAsyncScope())
        {
            leases = await scope.ServiceProvider.GetRequiredService<ScheduledActionLeaseStore>()
                .ClaimAsync(cancellationToken).ConfigureAwait(false);
        }
        foreach (ScheduledActionLease lease in leases)
        {
            await ProcessAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        return leases.Count;
    }

    private async Task ProcessAsync(
        ScheduledActionLease lease,
        CancellationToken cancellationToken)
    {
        try
        {
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<WorkflowWorkerApplication>()
                .CompleteScheduledActionAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            ActionFailed(logger, lease.ActionId, exception);
            await using AsyncServiceScope failureScope = scopeFactory.CreateAsyncScope();
            await failureScope.ServiceProvider.GetRequiredService<ScheduledActionLeaseStore>()
                .FailAsync(lease, exception, cancellationToken).ConfigureAwait(false);
        }
    }
}
