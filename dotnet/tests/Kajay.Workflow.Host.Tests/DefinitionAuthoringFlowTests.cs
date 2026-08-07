using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class DefinitionAuthoringFlowTests(WorkflowHostFixture fixture)
{
    private static readonly string[] AuthorPermissions =
        ["kajay:definition:manage", "kajay:definition:promote"];
    private static readonly string[] ApproverPermissions =
        ["kajay:definition:promote", "kajay:definition:approve"];
    private static readonly string[] OperatorPermissions =
        ["kajay:workflow:read", "kajay:workflow:execute"];

    [Fact]
    public async Task AuthoringReleasePromotionAndExecutionFormOneDurableFlow()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenantId = $"tenant-{suffix}";
        string managedName = $"managed-{suffix}";
        var author = new WorkflowTestClient(
            fixture.Client, tenantId, "author-1", AuthorPermissions);
        JsonElement draft = await SaveDraftAsync(author, managedName).ConfigureAwait(true);
        Assert.Equal(1, draft.GetProperty("version").GetInt64());
        Assert.StartsWith("sha256:", draft.GetProperty("definitionDigest").GetString(),
            StringComparison.Ordinal);

        JsonElement revision = await CheckpointAsync(author, managedName).ConfigureAwait(true);
        Assert.Equal(1, revision.GetProperty("number").GetInt64());
        await AssertCheckpointRetryAsync(author, managedName).ConfigureAwait(true);
        string releaseDigest = await CreateReleaseAsync(author, managedName).ConfigureAwait(true);

        var approver = new WorkflowTestClient(
            fixture.Client, tenantId, "approver-1", ApproverPermissions);
        await ActivateAsync(approver, managedName, releaseDigest).ConfigureAwait(true);

        var operatorClient = new WorkflowTestClient(
            fixture.Client, tenantId, "operator-1", OperatorPermissions);
        JsonElement started = await StartAsync(operatorClient, managedName).ConfigureAwait(true);
        Guid instanceId = started.GetProperty("id").GetGuid();
        string snapshot = await CreateCompletedSnapshotAsync().ConfigureAwait(true);
        await SaveAndCompleteAsync(operatorClient, instanceId, snapshot).ConfigureAwait(true);
    }

    [Fact]
    public async Task DraftValidationAndConcurrencyFailClosed()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"guarded-{suffix}";
        var author = new WorkflowTestClient(
            fixture.Client, $"tenant-{suffix}", "author-1", AuthorPermissions);
        _ = await SaveDraftAsync(author, managedName).ConfigureAwait(true);

        using HttpRequestMessage stale = author.Create(
            HttpMethod.Put,
            $"/api/management/definitions/{managedName}/draft",
            expectedVersion: 0);
        stale.Content = JsonContent.Create(new { definition = ReadDefinition() });
        using HttpResponseMessage conflict = await author.SendAsync(stale).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.PreconditionFailed, conflict.StatusCode);

        using HttpRequestMessage invalid = author.Create(
            HttpMethod.Put,
            $"/api/management/definitions/invalid-{suffix}/draft",
            expectedVersion: 0);
        invalid.Content = JsonContent.Create(new
        {
            definition = JsonNode.Parse("""{"pages":[{"name":"page","elements":[{"type":"missing","name":"q"}]}]}"""),
        });
        using HttpResponseMessage rejected = await author.SendAsync(invalid).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, rejected.StatusCode);
    }

    private static async Task<JsonElement> SaveDraftAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Put,
            $"/api/management/definitions/{managedName}/draft",
            expectedVersion: 0);
        request.Content = JsonContent.Create(new { definition = ReadDefinition() });
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("\"1\"", response.Headers.ETag?.Tag);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> CheckpointAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Post,
            $"/api/management/definitions/{managedName}/revisions",
            expectedVersion: 1);
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task<string> CreateReleaseAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Post,
            $"/api/management/definitions/{managedName}/revisions/1/releases");
        request.Content = JsonContent.Create(new
        {
            versionLabel = "1.0.0",
            requiredBindings = Array.Empty<string>(),
        });
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await CloneRootAsync(response).ConfigureAwait(false);
        return body.GetProperty("digest").GetString()!;
    }

    private static async Task AssertCheckpointRetryAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Post,
            $"/api/management/definitions/{managedName}/revisions",
            expectedVersion: 1);
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await CloneRootAsync(response).ConfigureAwait(false);
        Assert.Equal(1, body.GetProperty("number").GetInt64());
    }

    private static async Task ActivateAsync(
        WorkflowTestClient client,
        string managedName,
        string releaseDigest)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Put,
            $"/api/management/environments/production/activations/{managedName}",
            expectedVersion: 0);
        request.Content = JsonContent.Create(new { releaseDigest });
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonElement> StartAsync(
        WorkflowTestClient client,
        string managedName)
    {
        using HttpRequestMessage request = client.Create(
            HttpMethod.Post,
            $"/api/environments/production/definitions/{managedName}/instances",
            "authoring-start");
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task SaveAndCompleteAsync(
        WorkflowTestClient client,
        Guid instanceId,
        string snapshot)
    {
        using HttpRequestMessage save = client.Create(
            HttpMethod.Put, $"/api/instances/{instanceId}/response", "authoring-save", 1);
        save.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage saved = await client.SendAsync(save).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        using HttpRequestMessage complete = client.Create(
            HttpMethod.Post, $"/api/instances/{instanceId}/complete", "authoring-complete", 2);
        using HttpResponseMessage completed = await client.SendAsync(complete).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
        JsonElement body = await CloneRootAsync(completed).ConfigureAwait(false);
        Assert.Equal("completed", body.GetProperty("status").GetString());
    }

    private static async Task<string> CreateCompletedSnapshotAsync()
    {
        SurveyDefinition definition = SurveyDefinition.Parse(ReadDefinition().GetRawText()).Definition;
        Survey survey = definition.CreateSurvey();
        survey.SetValue("fullName", KajayValue.From("Ada"));
        _ = await survey.AdvanceAsync().ConfigureAwait(false);
        return survey.CreateSnapshot().ToJson();
    }

    private static JsonElement ReadDefinition() => JsonSerializer.Deserialize<JsonElement>("""
        {
          "title": "Managed onboarding",
          "pages": [{
            "name": "profile",
            "elements": [{ "type": "text", "name": "fullName", "required": true }]
          }]
        }
        """);

    private static async Task<JsonElement> CloneRootAsync(HttpResponseMessage response)
    {
        using JsonDocument document = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return document.RootElement.Clone();
    }
}
