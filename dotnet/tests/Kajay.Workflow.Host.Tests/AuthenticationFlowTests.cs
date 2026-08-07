using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class AuthenticationFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task ProtectedRoutesRequireAnOrganizationScopedBearerToken()
    {
        using var anonymous = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/instances/{Guid.CreateVersion7()}");
        using HttpResponseMessage anonymousResponse = await fixture.Client.SendAsync(anonymous)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);

        using var withoutOrganization = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/instances/{Guid.CreateVersion7()}");
        withoutOrganization.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokenIssuer.Instance.Issue(string.Empty));
        using HttpResponseMessage invalidResponse = await fixture.Client
            .SendAsync(withoutOrganization).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, invalidResponse.StatusCode);

        using var wrongAudience = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/instances/{Guid.CreateVersion7()}");
        wrongAudience.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokenIssuer.Instance.Issue("org-test", audience: "another-api"));
        using HttpResponseMessage wrongAudienceResponse = await fixture.Client
            .SendAsync(wrongAudience).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, wrongAudienceResponse.StatusCode);
    }

    [Fact]
    public async Task PermissionClaimsAndOrganizationBoundaryAreEnforced()
    {
        string suffix = Guid.NewGuid().ToString("N");
        byte[] bundle = KajayBundleFixture.Create($"auth-{suffix}");
        var unprivileged = new WorkflowTestClient(
            fixture.Client,
            $"org-unprivileged-{suffix}",
            permissions: []);
        using HttpRequestMessage forbidden = unprivileged.Create(
            HttpMethod.Post,
            "/api/management/releases/preflight?environmentName=test");
        forbidden.Content = new ByteArrayContent(bundle);
        using HttpResponseMessage forbiddenResponse = await unprivileged.SendAsync(forbidden)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);

        var tenantA = new WorkflowTestClient(fixture.Client, $"org-a-{suffix}");
        string digest = await InstallAsync(tenantA, bundle).ConfigureAwait(true);
        var tenantB = new WorkflowTestClient(fixture.Client, $"org-b-{suffix}");
        using HttpRequestMessage export = tenantB.Create(
            HttpMethod.Get,
            $"/api/management/releases/{digest}/bundle");
        using HttpResponseMessage hidden = await tenantB.SendAsync(export).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
    }

    [Fact]
    public async Task ProductionApprovalIsDerivedFromAnAuthorizedPrincipal()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenant = $"org-approval-{suffix}";
        string managedName = $"approval-{suffix}";
        var installer = new WorkflowTestClient(fixture.Client, tenant, "installer");
        await installer.EnsureEnvironmentAsync("production").ConfigureAwait(true);
        string digest = await InstallAsync(installer, KajayBundleFixture.Create(managedName))
            .ConfigureAwait(true);
        using HttpResponseMessage forbidden = await ActivateAsync(
            tenant,
            "promoter",
            ["kajay:definition:promote"],
            managedName,
            digest).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        using HttpResponseMessage approved = await ActivateAsync(
            tenant,
            "approver",
            ["kajay:definition:promote", "kajay:definition:approve"],
            managedName,
            digest).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(approved)
            .ConfigureAwait(true);
        Assert.Equal("approver", body.RootElement.GetProperty("approvedBy").GetString());
    }

    private static async Task<string> InstallAsync(WorkflowTestClient api, byte[] bundle)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            "/api/management/releases/install");
        request.Content = new ByteArrayContent(bundle);
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(true);
        response.EnsureSuccessStatusCode();
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(true);
        return body.RootElement.GetProperty("digest").GetString()!;
    }

    private async Task<HttpResponseMessage> ActivateAsync(
        string tenant,
        string actor,
        IReadOnlyCollection<string> permissions,
        string managedName,
        string digest)
    {
        var api = new WorkflowTestClient(fixture.Client, tenant, actor, permissions);
        using HttpRequestMessage request = api.Create(
            HttpMethod.Put,
            $"/api/management/environments/production/activations/{managedName}",
            expectedVersion: 0);
        request.Content = JsonContent.Create(new { releaseDigest = digest });
        return await api.SendAsync(request).ConfigureAwait(true);
    }
}
