using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class PromotionFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task ConcurrentFirstActivationsReturnOneVersionConflict()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"activation-{suffix}";
        var api = new WorkflowTestClient(fixture.Client, $"tenant-{suffix}");
        await api.EnsureEnvironmentAsync("test").ConfigureAwait(true);
        byte[] bundle = KajayBundleFixture.Create(managedName);
        using HttpRequestMessage install = api.Create(
            HttpMethod.Post,
            "/api/management/releases/install");
        install.Content = new ByteArrayContent(bundle);
        using HttpResponseMessage installed = await api.SendAsync(install).ConfigureAwait(true);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(installed)
            .ConfigureAwait(true);
        string digest = body.RootElement.GetProperty("digest").GetString()!;

        using HttpRequestMessage firstRequest = CreateActivationRequest(api, managedName, digest);
        using HttpRequestMessage secondRequest = CreateActivationRequest(api, managedName, digest);
        Task<HttpResponseMessage> first = api.SendAsync(firstRequest);
        Task<HttpResponseMessage> second = api.SendAsync(secondRequest);
        HttpResponseMessage[] responses = await Task.WhenAll(first, second).ConfigureAwait(true);
        using (responses[0])
        using (responses[1])
        {
            HttpStatusCode[] statuses = responses.Select(response => response.StatusCode)
                .Order().ToArray();
            Assert.Equal([HttpStatusCode.OK, HttpStatusCode.PreconditionFailed], statuses);
        }
    }

    [Fact]
    public async Task BundleCanBePreflightedInstalledExportedAndActivated()
    {
        var api = new WorkflowTestClient(fixture.Client, "tenant-1", "actor-1");
        await api.EnsureEnvironmentAsync("production").ConfigureAwait(true);
        byte[] bundle = KajayBundleFixture.Create(requiredBindings: ["crm"]);
        using HttpResponseMessage blockedPreflight = await SendBundleAsync(
            "/api/management/releases/preflight?environmentName=production",
            bundle).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, blockedPreflight.StatusCode);
        using JsonDocument blocked = await ReadJsonAsync(blockedPreflight).ConfigureAwait(true);
        Assert.False(blocked.RootElement.GetProperty("compatible").GetBoolean());
        Assert.Equal("crm", blocked.RootElement.GetProperty("missingBindings")[0].GetString());

        using HttpResponseMessage binding = await SendJsonAsync(
            HttpMethod.Put,
            "/api/management/environments/production/bindings/crm",
            new { reference = "secret://production/crm" },
            expectedVersion: 0).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, binding.StatusCode);

        using HttpResponseMessage installed = await SendBundleAsync(
            "/api/management/releases/install",
            bundle).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, installed.StatusCode);
        using JsonDocument installResult = await ReadJsonAsync(installed).ConfigureAwait(true);
        string digest = installResult.RootElement.GetProperty("digest").GetString()!;
        Assert.StartsWith("sha256:", digest, StringComparison.Ordinal);

        using HttpRequestMessage installedPreflightRequest = CreateRequest(
            HttpMethod.Post,
            $"/api/management/releases/{digest}/preflight?environmentName=production");
        using HttpResponseMessage installedPreflight = await fixture.Client
            .SendAsync(installedPreflightRequest).ConfigureAwait(true);
        using JsonDocument installedPreflightBody = await ReadJsonAsync(installedPreflight)
            .ConfigureAwait(true);
        Assert.True(installedPreflightBody.RootElement.GetProperty("compatible").GetBoolean());
        Assert.True(installedPreflightBody.RootElement.GetProperty("requiresApproval").GetBoolean());

        using HttpResponseMessage repeated = await SendBundleAsync(
            "/api/management/releases/install",
            bundle).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        using JsonDocument repeatResult = await ReadJsonAsync(repeated).ConfigureAwait(true);
        Assert.False(repeatResult.RootElement.GetProperty("installed").GetBoolean());

        using HttpResponseMessage activated = await SendActivationAsync(digest, "0")
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, activated.StatusCode);
        Assert.Equal("\"1\"", activated.Headers.ETag?.Tag);

        using HttpResponseMessage stale = await SendActivationAsync(digest, "0")
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);

        using HttpRequestMessage exportRequest = CreateRequest(
            HttpMethod.Get,
            $"/api/management/releases/{digest}/bundle");
        using HttpResponseMessage exported = await fixture.Client.SendAsync(exportRequest)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, exported.StatusCode);
        Assert.Equal(bundle, await exported.Content.ReadAsByteArrayAsync().ConfigureAwait(true));
    }

    private async Task<HttpResponseMessage> SendBundleAsync(string path, byte[] bundle)
    {
        using HttpRequestMessage request = CreateRequest(HttpMethod.Post, path);
        request.Content = new ByteArrayContent(bundle);
        request.Content.Headers.ContentType = new("application/vnd.kajay.bundle+zip");
        return await fixture.Client.SendAsync(request).ConfigureAwait(true);
    }

    private static HttpRequestMessage CreateActivationRequest(
        WorkflowTestClient api,
        string managedName,
        string digest)
    {
        HttpRequestMessage request = api.Create(
            HttpMethod.Put,
            $"/api/management/environments/test/activations/{managedName}",
            expectedVersion: 0);
        request.Content = JsonContent.Create(new { releaseDigest = digest });
        return request;
    }

    private async Task<HttpResponseMessage> SendActivationAsync(string digest, string version)
    {
        using HttpRequestMessage request = CreateRequest(
            HttpMethod.Put,
            "/api/management/environments/production/activations/onboarding");
        request.Headers.TryAddWithoutValidation("If-Match", $"\"{version}\"");
        request.Content = JsonContent.Create(new { releaseDigest = digest });
        return await fixture.Client.SendAsync(request).ConfigureAwait(true);
    }

    private async Task<HttpResponseMessage> SendJsonAsync(
        HttpMethod method,
        string path,
        object body,
        long? expectedVersion = null)
    {
        using HttpRequestMessage request = CreateRequest(method, path);
        if (expectedVersion is not null)
        {
            request.Headers.TryAddWithoutValidation("If-Match", $"\"{expectedVersion}\"");
        }
        request.Content = JsonContent.Create(body);
        return await fixture.Client.SendAsync(request).ConfigureAwait(true);
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokenIssuer.Instance.Issue("tenant-1", "actor-1"));
        return request;
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        await using Stream stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
        return await JsonDocument.ParseAsync(stream).ConfigureAwait(true);
    }
}
