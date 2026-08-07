using Kajay.Workflow.Host.Delivery;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;

namespace Kajay.Workflow.Host.Tests;

public sealed class WorkflowHostFixture : IAsyncLifetime
{
    private readonly ILoggerFactory _loggerFactory = LoggerFactory.Create(_ => { });
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18-alpine")
        .WithDatabase("kajay_tests")
        .WithUsername("kajay")
        .WithPassword("kajay")
        .Build();
    private WebApplicationFactory<Program>? _factory;

    public HttpClient Client => (_factory
        ?? throw new InvalidOperationException("The workflow host fixture is not initialized."))
        .CreateClient();

    public WorkflowWorkerHost CreateWorkerHost(
        IWorkflowEffectHandler? effectHandler = null,
        int maximumAttempts = 8)
    {
        Quartz.Logging.LogContext.SetCurrentLogProvider(_loggerFactory);
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            _ = builder.UseSetting("ConnectionStrings:Workflow", _postgres.GetConnectionString());
            ConfigureWorkOS(builder);
            _ = builder.UseSetting("WorkflowWorkers:Enabled", "true");
            _ = builder.UseSetting("WorkflowWorkers:PollInterval", "00:00:00.050");
            _ = builder.UseSetting("WorkflowWorkers:LeaseDuration", "00:00:05");
            _ = builder.UseSetting(
                "WorkflowWorkers:MaximumAttempts",
                maximumAttempts.ToString(System.Globalization.CultureInfo.InvariantCulture));
            if (effectHandler is not null)
            {
                builder.ConfigureTestServices(services =>
                {
                    services.RemoveAll<IWorkflowEffectHandler>();
                    services.AddSingleton(effectHandler);
                });
            }
            builder.ConfigureTestServices(ConfigureAuthentication);
        });
        return new WorkflowWorkerHost(factory);
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync().ConfigureAwait(false);
        Quartz.Logging.LogContext.SetCurrentLogProvider(_loggerFactory);
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            _ = builder.UseSetting("ConnectionStrings:Workflow", _postgres.GetConnectionString());
            ConfigureWorkOS(builder);
            _ = builder.UseSetting("WorkflowWorkers:Enabled", "false");
            builder.ConfigureTestServices(ConfigureAuthentication);
        });
        _ = _factory.Server;
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync().ConfigureAwait(false);
        }
        await _postgres.DisposeAsync().ConfigureAwait(false);
        _loggerFactory.Dispose();
    }

    private static void ConfigureWorkOS(IWebHostBuilder builder)
    {
        _ = builder.UseSetting("WorkOS:ApiBaseUrl", TestTokenIssuer.Issuer);
        _ = builder.UseSetting("WorkOS:ClientId", TestTokenIssuer.Audience);
        _ = builder.UseSetting("WorkOS:Issuer", TestTokenIssuer.Issuer);
    }

    private void ConfigureAuthentication(IServiceCollection services)
    {
        // Quartz.NET's logging bridge is process-global. Test replicas therefore share an
        // externally owned logger factory that remains valid until the collection is disposed.
        services.RemoveAll<ILoggerFactory>();
        services.AddSingleton(_loggerFactory);
        services.PostConfigure<JwtBearerOptions>(
            JwtBearerDefaults.AuthenticationScheme,
            TestTokenIssuer.Instance.Configure);
    }
}
