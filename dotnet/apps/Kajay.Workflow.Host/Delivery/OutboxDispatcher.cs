using Microsoft.Extensions.Options;

namespace Kajay.Workflow.Host.Delivery;

internal sealed class OutboxDispatcher(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    IOptions<WorkflowWorkerOptions> options,
    ILogger<OutboxDispatcher> logger) : BackgroundService
{
    private static readonly Action<ILogger, string, Exception?> DeliveryFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1, nameof(DeliveryFailed)),
            "Workflow effect {EffectId} delivery failed");

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
        IReadOnlyList<OutboxLease> leases;
        await using (AsyncServiceScope scope = scopeFactory.CreateAsyncScope())
        {
            leases = await scope.ServiceProvider.GetRequiredService<OutboxLeaseStore>()
                .ClaimAsync(cancellationToken).ConfigureAwait(false);
        }
        foreach (OutboxLease lease in leases)
        {
            await ProcessAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        return leases.Count;
    }

    private async Task ProcessAsync(OutboxLease lease, CancellationToken cancellationToken)
    {
        try
        {
            await using AsyncServiceScope deliveryScope = scopeFactory.CreateAsyncScope();
            IWorkflowEffectHandler handler = deliveryScope.ServiceProvider
                .GetRequiredService<IWorkflowEffectHandler>();
            await handler.DeliverAsync(lease.Effect, cancellationToken).ConfigureAwait(false);

            await using AsyncServiceScope completionScope = scopeFactory.CreateAsyncScope();
            await completionScope.ServiceProvider.GetRequiredService<WorkflowWorkerApplication>()
                .CompleteEffectAsync(lease, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            DeliveryFailed(logger, lease.Effect.Id, exception);
            await using AsyncServiceScope failureScope = scopeFactory.CreateAsyncScope();
            await failureScope.ServiceProvider.GetRequiredService<OutboxLeaseStore>()
                .FailAsync(lease, exception, cancellationToken).ConfigureAwait(false);
        }
    }
}
