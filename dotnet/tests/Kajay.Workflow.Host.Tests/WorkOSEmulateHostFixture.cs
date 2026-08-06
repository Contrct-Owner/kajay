using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Configurations;
using DotNet.Testcontainers.Containers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace Kajay.Workflow.Host.Tests;

public sealed class WorkOSEmulateHostFixture : IAsyncLifetime
{
    internal const string Issuer = "https://auth.kajay.emulate/";
    private const ushort EmulatePort = 4100;
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18-alpine")
        .WithDatabase("kajay_emulate_tests")
        .WithUsername("kajay")
        .WithPassword("kajay")
        .Build();
    private readonly IContainer _emulator = CreateEmulator();
    private WebApplicationFactory<Program>? _factory;

    public HttpClient Client => (_factory
        ?? throw new InvalidOperationException("The WorkOS Emulate fixture is not initialized."))
        .CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = false,
        });

    public Uri EmulatorUri { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _emulator.StartAsync()).ConfigureAwait(false);
        EmulatorUri = new UriBuilder(
            Uri.UriSchemeHttp,
            _emulator.Hostname,
            _emulator.GetMappedPublicPort(EmulatePort)).Uri;
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(ConfigureHost);
        _ = _factory.Server;
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync().ConfigureAwait(false);
        }
        await Task.WhenAll(_postgres.DisposeAsync().AsTask(), _emulator.DisposeAsync().AsTask())
            .ConfigureAwait(false);
    }

    private void ConfigureHost(IWebHostBuilder builder)
    {
        string emulatorUrl = EmulatorUri.GetLeftPart(UriPartial.Authority);
        _ = builder.UseSetting("ConnectionStrings:Workflow", _postgres.GetConnectionString());
        _ = builder.UseSetting("WorkOS:ApiBaseUrl", emulatorUrl);
        _ = builder.UseSetting("WorkOS:Audience", "client_kajay_local");
        _ = builder.UseSetting("WorkOS:ClientId", "client_kajay_local");
        _ = builder.UseSetting("WorkOS:Issuer", Issuer);
        _ = builder.UseSetting("WorkOS:RequireHttpsMetadata", "false");
        _ = builder.UseSetting("WorkOS:Session:ApiKey", "sk_test_default");
        _ = builder.UseSetting("WorkOS:Session:BrowserBaseUrl", emulatorUrl);
        _ = builder.UseSetting("WorkOS:Session:CallbackUrl", "http://localhost/auth/callback");
        _ = builder.UseSetting("WorkOS:Session:Enabled", "true");
        _ = builder.UseSetting(
            "WorkOS:Session:PostLoginRedirectUrl",
            "http://localhost/auth/session");
        _ = builder.UseSetting(
            "WorkOS:Session:PostLogoutRedirectUrl",
            "http://localhost/health");
        _ = builder.UseSetting("WorkflowWorkers:Enabled", "false");
    }

    private static IContainer CreateEmulator()
    {
        string seedPath = Path.Combine(
            AppContext.BaseDirectory,
            "Fixtures",
            "workos-emulate.config.yaml");
        return new ContainerBuilder("ghcr.io/workos/emulate:0.6.0")
            .WithPortBinding(EmulatePort, true)
            .WithBindMount(seedPath, "/app/workos-emulate.config.yaml", AccessMode.ReadOnly)
            .WithCommand(
                "--host",
                "0.0.0.0",
                "--interactive",
                "--issuer",
                Issuer)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(
                request => request.ForPort(EmulatePort).ForPath("/health")))
            .Build();
    }
}
