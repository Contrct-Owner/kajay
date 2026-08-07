using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class DefinitionProvenanceFlowTests(WorkflowHostFixture fixture)
{
    private static readonly string[] Permissions =
        ["kajay:definition:manage", "kajay:definition:promote"];

    [Fact]
    public async Task ProvenanceExplainsReadinessAndSupportsVersionCheckedRollback()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenantId = $"tenant-{suffix}";
        string managedName = $"history-{suffix}";
        var client = new WorkflowTestClient(fixture.Client, tenantId, "release-manager", Permissions);

        string first = await AuthorReleaseAsync(
            client, managedName, 0, "First", "1.0.0", []).ConfigureAwait(true);
        await ActivateAsync(client, managedName, first, 0).ConfigureAwait(true);
        string second = await AuthorReleaseAsync(
            client, managedName, 1, "Second", "2.0.0", []).ConfigureAwait(true);
        await ActivateAsync(client, managedName, second, 1).ConfigureAwait(true);
        string blocked = await AuthorReleaseAsync(
            client, managedName, 2, "Blocked", "3.0.0", ["crm"]).ConfigureAwait(true);

        JsonElement provenance = await ReadProvenanceAsync(client, managedName)
            .ConfigureAwait(true);
        Assert.Equal(2, provenance.GetProperty("activation").GetProperty("version").GetInt64());
        Assert.Equal("2.0.0", provenance.GetProperty("activation")
            .GetProperty("versionLabel").GetString());
        Assert.Equal("release-manager", provenance.GetProperty("activation")
            .GetProperty("activatedBy").GetString());
        Assert.Equal([1, 2, 3], provenance.GetProperty("revisions").EnumerateArray()
            .Select(item => item.GetProperty("number").GetInt64()).Order().ToArray());

        JsonElement firstRelease = FindRelease(provenance, first);
        Assert.Equal("ready", firstRelease.GetProperty("promotionStatus").GetString());
        Assert.True(firstRelease.GetProperty("canRollback").GetBoolean());
        Assert.Equal(1, firstRelease.GetProperty("sourceRevisionNumbers")[0].GetInt64());
        JsonElement activeRelease = FindRelease(provenance, second);
        Assert.Equal("active", activeRelease.GetProperty("promotionStatus").GetString());
        Assert.False(activeRelease.GetProperty("canRollback").GetBoolean());
        JsonElement blockedRelease = FindRelease(provenance, blocked);
        Assert.Equal("blocked", blockedRelease.GetProperty("promotionStatus").GetString());
        Assert.Equal("crm", blockedRelease.GetProperty("missingBindings")[0].GetString());
        Assert.Contains(provenance.GetProperty("auditEvents").EnumerateArray(),
            item => item.GetProperty("eventType").GetString() == "definition-release-activated");

        await ActivateAsync(client, managedName, first, 2).ConfigureAwait(true);
        JsonElement rolledBack = await ReadProvenanceAsync(client, managedName)
            .ConfigureAwait(true);
        Assert.Equal(3, rolledBack.GetProperty("activation").GetProperty("version").GetInt64());
        Assert.Equal(first, rolledBack.GetProperty("activation")
            .GetProperty("releaseDigest").GetString());
        Assert.Equal("active", FindRelease(rolledBack, first)
            .GetProperty("promotionStatus").GetString());
    }

    [Fact]
    public async Task ProvenanceIsTenantScoped()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"private-{suffix}";
        var owner = new WorkflowTestClient(
            fixture.Client, $"tenant-owner-{suffix}", "owner", Permissions);
        _ = await AuthorReleaseAsync(owner, managedName, 0, "Private", "1.0.0", [])
            .ConfigureAwait(true);
        var outsider = new WorkflowTestClient(
            fixture.Client, $"tenant-other-{suffix}", "outsider", Permissions);
        using HttpRequestMessage request = outsider.Create(
            HttpMethod.Get,
            $"/api/management/definitions/{managedName}/provenance?environmentName=test");
        using HttpResponseMessage response = await outsider.SendAsync(request).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<string> AuthorReleaseAsync(
        WorkflowTestClient client,
        string managedName,
        long currentDraftVersion,
        string title,
        string versionLabel,
        string[] requiredBindings)
    {
        long draftVersion = currentDraftVersion + 1;
        using HttpRequestMessage save = client.Create(
            HttpMethod.Put,
            $"/api/management/definitions/{managedName}/draft",
            expectedVersion: currentDraftVersion);
        save.Content = JsonContent.Create(new { definition = CreateDefinition(title) });
        using HttpResponseMessage saved = await client.SendAsync(save).ConfigureAwait(false);
        Assert.True(saved.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK);

        using HttpRequestMessage checkpoint = client.Create(
            HttpMethod.Post,
            $"/api/management/definitions/{managedName}/revisions",
            expectedVersion: draftVersion);
        using HttpResponseMessage checkpointed = await client.SendAsync(checkpoint)
            .ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, checkpointed.StatusCode);
        using JsonDocument revision = await WorkflowTestClient.ReadJsonAsync(checkpointed)
            .ConfigureAwait(false);
        long revisionNumber = revision.RootElement.GetProperty("number").GetInt64();

        using HttpRequestMessage release = client.Create(
            HttpMethod.Post,
            $"/api/management/definitions/{managedName}/revisions/{revisionNumber}/releases");
        release.Content = JsonContent.Create(new { versionLabel, requiredBindings });
        using HttpResponseMessage released = await client.SendAsync(release).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, released.StatusCode);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(released)
            .ConfigureAwait(false);
        return body.RootElement.GetProperty("digest").GetString()!;
    }

    private static async Task ActivateAsync(
        WorkflowTestClient client,
        string managedName,
        string releaseDigest,
        long expectedVersion)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Put,
            $"/api/management/environments/test/activations/{managedName}",
            expectedVersion: expectedVersion);
        request.Content = JsonContent.Create(new { releaseDigest });
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonElement> ReadProvenanceAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Get,
            $"/api/management/definitions/{managedName}/provenance?environmentName=test");
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return body.RootElement.Clone();
    }

    private static JsonElement FindRelease(JsonElement provenance, string digest) =>
        provenance.GetProperty("releases").EnumerateArray()
            .Single(item => item.GetProperty("digest").GetString() == digest);

    private static JsonElement CreateDefinition(string title) =>
        JsonSerializer.Deserialize<JsonElement>($$"""
            {
              "title": "{{title}}",
              "pages": [{
                "name": "profile",
                "elements": [{ "type": "text", "name": "fullName" }]
              }]
            }
            """);
}
