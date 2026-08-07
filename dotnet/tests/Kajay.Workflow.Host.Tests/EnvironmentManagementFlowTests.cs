using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class EnvironmentManagementFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task CatalogAndWriteOnlyBindingsAreVersionChecked()
    {
        string suffix = Guid.NewGuid().ToString("N");
        var manager = new WorkflowTestClient(fixture.Client, $"tenant-{suffix}", "manager");
        await manager.EnsureEnvironmentAsync("quality", requiresApproval: false)
            .ConfigureAwait(true);

        using HttpResponseMessage listed = await SendAsync(
            manager, HttpMethod.Get, "/api/management/environments").ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, listed.StatusCode);
        using JsonDocument environments = await WorkflowTestClient.ReadJsonAsync(listed)
            .ConfigureAwait(true);
        JsonElement quality = environments.RootElement.EnumerateArray()
            .Single(item => item.GetProperty("name").GetString() == "quality");
        Assert.Equal(1, quality.GetProperty("version").GetInt64());

        using HttpResponseMessage updated = await SendJsonAsync(
            manager,
            HttpMethod.Put,
            "/api/management/environments/quality",
            new { displayName = "Quality assurance", requiresApproval = true, position = 350 },
            expectedVersion: 1).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("\"2\"", updated.Headers.ETag?.Tag);

        using HttpResponseMessage binding = await SendJsonAsync(
            manager,
            HttpMethod.Put,
            "/api/management/environments/quality/bindings/crm",
            new { reference = "secret://quality/crm" },
            expectedVersion: 0).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, binding.StatusCode);
        using JsonDocument bindingBody = await WorkflowTestClient.ReadJsonAsync(binding)
            .ConfigureAwait(true);
        Assert.False(bindingBody.RootElement.TryGetProperty("reference", out _));

        using HttpResponseMessage bindings = await SendAsync(
            manager, HttpMethod.Get, "/api/management/environments/quality/bindings")
            .ConfigureAwait(true);
        string json = await bindings.Content.ReadAsStringAsync().ConfigureAwait(true);
        Assert.DoesNotContain("secret://quality/crm", json, StringComparison.Ordinal);

        using HttpResponseMessage stale = await SendJsonAsync(
            manager,
            HttpMethod.Put,
            "/api/management/environments/quality/bindings/crm",
            new { reference = "secret://quality/replacement" },
            expectedVersion: 0).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);

        using HttpResponseMessage removed = await SendAsync(
            manager,
            HttpMethod.Delete,
            "/api/management/environments/quality/bindings/crm",
            expectedVersion: 1).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);

        var author = new WorkflowTestClient(
            fixture.Client,
            $"tenant-{suffix}",
            "author",
            ["kajay:definition:manage"]);
        using HttpResponseMessage forbidden = await SendJsonAsync(
            author,
            HttpMethod.Put,
            "/api/management/environments/quality",
            new { displayName = "Quality", requiresApproval = false, position = 350 },
            expectedVersion: 2).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task ApprovalFollowsEnvironmentPolicyRatherThanItsName()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenant = $"tenant-{suffix}";
        string managedName = $"policy-{suffix}";
        var manager = new WorkflowTestClient(fixture.Client, tenant, "manager");
        await manager.EnsureEnvironmentAsync("quality", requiresApproval: true)
            .ConfigureAwait(true);
        string digest = await InstallAsync(manager, managedName).ConfigureAwait(true);

        using HttpResponseMessage forbidden = await ActivateAsync(
            tenant, "promoter", ["kajay:definition:promote"], managedName, digest)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        using HttpResponseMessage approved = await ActivateAsync(
            tenant,
            "approver",
            ["kajay:definition:promote", "kajay:definition:approve"],
            managedName,
            digest).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
    }

    private static async Task<string> InstallAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Post, "/api/management/releases/install");
        request.Content = new ByteArrayContent(KajayBundleFixture.Create(managedName));
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return body.RootElement.GetProperty("digest").GetString()!;
    }

    private async Task<HttpResponseMessage> ActivateAsync(
        string tenant,
        string actor,
        IReadOnlyCollection<string> permissions,
        string managedName,
        string digest)
    {
        var client = new WorkflowTestClient(fixture.Client, tenant, actor, permissions);
        return await SendJsonAsync(
            client,
            HttpMethod.Put,
            $"/api/management/environments/quality/activations/{managedName}",
            new { releaseDigest = digest },
            expectedVersion: 0).ConfigureAwait(true);
    }

    private static async Task<HttpResponseMessage> SendAsync(
        WorkflowTestClient client,
        HttpMethod method,
        string path,
        long? expectedVersion = null)
    {
        using HttpRequestMessage request = client.Create(
            method, path, expectedVersion: expectedVersion);
        return await client.SendAsync(request).ConfigureAwait(false);
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        WorkflowTestClient client,
        HttpMethod method,
        string path,
        object body,
        long? expectedVersion = null)
    {
        using HttpRequestMessage request = client.Create(
            method, path, expectedVersion: expectedVersion);
        request.Content = JsonContent.Create(body);
        return await client.SendAsync(request).ConfigureAwait(false);
    }
}
