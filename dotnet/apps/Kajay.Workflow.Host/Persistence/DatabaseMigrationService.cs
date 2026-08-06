using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Persistence;

internal sealed class DatabaseMigrationService(
    IServiceScopeFactory scopeFactory,
    ILogger<DatabaseMigrationService> logger) : IHostedService
{
    private static readonly Action<ILogger, Exception?> MigrationCompleted =
        LoggerMessage.Define(
            LogLevel.Information,
            new EventId(1, nameof(MigrationCompleted)),
            "Workflow database migrations are current");

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
        WorkflowDbContext database = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        await database.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        MigrationCompleted(logger, null);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
