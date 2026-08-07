using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class DefinitionReleaseComparisonFlowTests(WorkflowHostFixture fixture)
{
    private static readonly string[] Permissions =
        ["kajay:definition:manage", "kajay:definition:promote"];

    [Fact]
    public async Task ComparisonExplainsSemanticArtifactChangesAgainstActiveRelease()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"compare-{suffix}";
        var client = new WorkflowTestClient(
            fixture.Client, $"tenant-{suffix}", "release-manager", Permissions);
        string first = await AuthorReleaseAsync(
            client, managedName, 0, FirstDefinition(), "1.0.0", []).ConfigureAwait(true);
        await ActivateAsync(client, managedName, first).ConfigureAwait(true);
        string second = await AuthorReleaseAsync(
            client, managedName, 1, SecondDefinition(), "2.0.0", ["crm"])
            .ConfigureAwait(true);

        JsonElement comparison = await ReadComparisonAsync(client, managedName, second)
            .ConfigureAwait(true);
        Assert.Equal(first, comparison.GetProperty("baseline").GetProperty("digest").GetString());
        Assert.Equal("2.0.0", comparison.GetProperty("target")
            .GetProperty("versionLabel").GetString());
        Assert.False(comparison.GetProperty("initialRelease").GetBoolean());
        Assert.False(comparison.GetProperty("truncated").GetBoolean());
        JsonElement[] changes = comparison.GetProperty("changes").EnumerateArray().ToArray();
        Assert.Contains(changes, item => IsChange(
            item, "changed", "definition", ".definition.title"));
        Assert.Contains(changes, item => IsChange(
            item, "added", "definition", "elements[name=\"email\"]"));
        Assert.Contains(changes, item => IsChange(
            item, "added", "bindings", "requiredBindings[0]"));
        Assert.DoesNotContain(changes, item => item.GetProperty("path").GetString()!
            .Contains("surveyDefinitionDigest", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ComparisonSupportsExplicitBaselineAndInitialRelease()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"baseline-{suffix}";
        var client = new WorkflowTestClient(
            fixture.Client, $"tenant-{suffix}", "release-manager", Permissions);
        string first = await AuthorReleaseAsync(
            client, managedName, 0, FirstDefinition(), "1.0.0", []).ConfigureAwait(true);
        string second = await AuthorReleaseAsync(
            client, managedName, 1, SecondDefinition(), "2.0.0", []).ConfigureAwait(true);

        JsonElement initial = await ReadComparisonAsync(client, managedName, first)
            .ConfigureAwait(true);
        Assert.True(initial.GetProperty("initialRelease").GetBoolean());
        Assert.Equal(JsonValueKind.Null, initial.GetProperty("baseline").ValueKind);
        Assert.Equal(0, initial.GetProperty("summary").GetProperty("total").GetInt32());

        JsonElement explicitBaseline = await ReadComparisonAsync(
            client, managedName, first, second).ConfigureAwait(true);
        Assert.Equal(second, explicitBaseline.GetProperty("baseline")
            .GetProperty("digest").GetString());
        Assert.Contains(explicitBaseline.GetProperty("changes").EnumerateArray(),
            item => item.GetProperty("kind").GetString() == "removed");
    }

    private static bool IsChange(JsonElement item, string kind, string area, string path) =>
        item.GetProperty("kind").GetString() == kind
            && item.GetProperty("area").GetString() == area
            && item.GetProperty("path").GetString()!.Contains(path, StringComparison.Ordinal);

    private static async Task<string> AuthorReleaseAsync(
        WorkflowTestClient client,
        string managedName,
        long currentVersion,
        JsonElement definition,
        string versionLabel,
        string[] requiredBindings)
    {
        using HttpRequestMessage save = client.Create(
            HttpMethod.Put, $"/api/management/definitions/{managedName}/draft",
            expectedVersion: currentVersion);
        save.Content = JsonContent.Create(new { definition });
        using HttpResponseMessage saved = await client.SendAsync(save).ConfigureAwait(false);
        Assert.True(saved.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK);
        using HttpRequestMessage checkpoint = client.Create(
            HttpMethod.Post, $"/api/management/definitions/{managedName}/revisions",
            expectedVersion: currentVersion + 1);
        using HttpResponseMessage checkpointed = await client.SendAsync(checkpoint)
            .ConfigureAwait(false);
        using JsonDocument revision = await WorkflowTestClient.ReadJsonAsync(checkpointed)
            .ConfigureAwait(false);
        long number = revision.RootElement.GetProperty("number").GetInt64();
        using HttpRequestMessage release = client.Create(
            HttpMethod.Post,
            $"/api/management/definitions/{managedName}/revisions/{number}/releases");
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
        string releaseDigest)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Put, $"/api/management/environments/test/activations/{managedName}",
            expectedVersion: 0);
        request.Content = JsonContent.Create(new { releaseDigest });
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonElement> ReadComparisonAsync(
        WorkflowTestClient client,
        string managedName,
        string targetDigest,
        string? baselineDigest = null)
    {
        string query = $"environmentName=test{(baselineDigest is null ? string.Empty
            : $"&baselineDigest={Uri.EscapeDataString(baselineDigest)}")}";
        using HttpRequestMessage request = client.Create(
            HttpMethod.Get,
            $"/api/management/definitions/{managedName}/provenance/releases/"
                + $"{Uri.EscapeDataString(targetDigest)}/comparison?{query}");
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return body.RootElement.Clone();
    }

    private static JsonElement FirstDefinition() => JsonSerializer.Deserialize<JsonElement>("""
        {"title":"First","pages":[{"name":"profile","elements":[
          {"type":"text","name":"fullName"}]}]}
        """);

    private static JsonElement SecondDefinition() => JsonSerializer.Deserialize<JsonElement>("""
        {"title":"Second","pages":[{"name":"profile","elements":[
          {"type":"text","name":"fullName"},{"type":"text","name":"email"}]}]}
        """);
}
