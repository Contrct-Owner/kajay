using Microsoft.AspNetCore.Mvc.Testing;

namespace Kajay.Workflow.Host.Tests;

public sealed class WorkflowWorkerHost : IAsyncDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    internal WorkflowWorkerHost(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        Client = factory.CreateClient();
    }

    public HttpClient Client { get; }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await _factory.DisposeAsync().ConfigureAwait(false);
    }
}
