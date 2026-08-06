using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Workflow.Host.Tests;

internal sealed class WorkflowTestClient
{
    private readonly string _accessToken;
    private readonly HttpClient _client;

    internal WorkflowTestClient(
        HttpClient client,
        string tenantId,
        string actorId = "test-actor",
        IReadOnlyCollection<string>? permissions = null)
    {
        _client = client;
        _accessToken = TestTokenIssuer.Instance.Issue(tenantId, actorId, permissions);
    }

    internal Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken = default)
    {
        return _client.SendAsync(request, cancellationToken);
    }

    internal async Task<string> InstallAndActivateAsync(
        string environmentName,
        string managedDefinitionName,
        byte[] bundle)
    {
        using HttpRequestMessage install = Create(HttpMethod.Post, "/api/management/releases/install");
        install.Content = new ByteArrayContent(bundle);
        using HttpResponseMessage installed = await _client.SendAsync(install).ConfigureAwait(false);
        installed.EnsureSuccessStatusCode();
        using JsonDocument body = await ReadJsonAsync(installed).ConfigureAwait(false);
        string digest = body.RootElement.GetProperty("digest").GetString()!;

        using HttpRequestMessage activate = Create(
            HttpMethod.Put,
            $"/api/management/environments/{environmentName}/activations/{managedDefinitionName}");
        activate.Headers.TryAddWithoutValidation("If-Match", "\"0\"");
        activate.Content = JsonContent.Create(new { releaseDigest = digest });
        using HttpResponseMessage activated = await _client.SendAsync(activate).ConfigureAwait(false);
        activated.EnsureSuccessStatusCode();
        return digest;
    }

    internal HttpRequestMessage Create(
        HttpMethod method,
        string path,
        string? idempotencyKey = null,
        long? expectedVersion = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }
        if (expectedVersion is not null)
        {
            request.Headers.TryAddWithoutValidation("If-Match", $"\"{expectedVersion}\"");
        }
        return request;
    }

    internal static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        await using Stream stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
        return await JsonDocument.ParseAsync(stream).ConfigureAwait(false);
    }
}
