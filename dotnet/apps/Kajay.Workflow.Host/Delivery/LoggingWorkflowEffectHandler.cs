namespace Kajay.Workflow.Host.Delivery;

internal sealed class LoggingWorkflowEffectHandler(
    ILogger<LoggingWorkflowEffectHandler> logger) : IWorkflowEffectHandler
{
    private static readonly Action<ILogger, string, string, Exception?> EffectDelivered =
        LoggerMessage.Define<string, string>(
            LogLevel.Information,
            new EventId(1, nameof(EffectDelivered)),
            "Delivered workflow effect {EffectId} of type {EffectType}");

    public Task DeliverAsync(WorkflowEffect effect, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        EffectDelivered(logger, effect.Id, effect.Type, null);
        return Task.CompletedTask;
    }
}
