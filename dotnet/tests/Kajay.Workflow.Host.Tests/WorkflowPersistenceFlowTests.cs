using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class WorkflowPersistenceFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task ConcurrentStartRetriesReturnTheSameInstance()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"concurrent-{suffix}";
        string tenantId = $"tenant-{suffix}";
        byte[] bundle = KajayBundleFixture.Create(managedName);
        var api = new WorkflowTestClient(fixture.Client, tenantId);
        _ = await api.InstallAndActivateAsync("test", managedName, bundle).ConfigureAwait(true);

        Task<Guid> first = SendStartAsync(api, managedName, "same-start-key");
        Task<Guid> second = SendStartAsync(api, managedName, "same-start-key");
        Guid[] ids = await Task.WhenAll(first, second).ConfigureAwait(true);

        Assert.Equal(ids[0], ids[1]);
    }

    [Fact]
    public async Task InstanceCanBeSavedResumedAndTransitionedIdempotently()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"onboarding-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            "1.0.0",
            includeEffect: true);
        var api = new WorkflowTestClient(fixture.Client, $"tenant-{suffix}");
        string releaseDigest = await api.InstallAndActivateAsync(
            "test",
            managedName,
            scenario.Bundle).ConfigureAwait(true);

        JsonElement started = await StartAsync(api, managedName).ConfigureAwait(true);
        Guid instanceId = started.GetProperty("id").GetGuid();
        Assert.Equal(releaseDigest, started.GetProperty("releaseDigest").GetString());
        Assert.Equal(1, started.GetProperty("version").GetInt64());

        string completedSnapshot = await CreateCompletedSnapshotAsync(scenario.Survey)
            .ConfigureAwait(true);
        JsonElement saved = await SaveAsync(api, instanceId, completedSnapshot, "save-1", 1)
            .ConfigureAwait(true);
        Assert.Equal(2, saved.GetProperty("version").GetInt64());

        JsonElement repeated = await SaveAsync(api, instanceId, completedSnapshot, "save-1", 1)
            .ConfigureAwait(true);
        Assert.Equal(2, repeated.GetProperty("version").GetInt64());
        await AssertStaleSaveFailsAsync(api, instanceId, completedSnapshot).ConfigureAwait(true);

        JsonElement resumed = await GetAsync(api, instanceId).ConfigureAwait(true);
        Assert.Equal("Ada", resumed.GetProperty("responseSnapshot")
            .GetProperty("data").GetProperty("fullName").GetProperty("value").GetString());

        JsonElement transitioned = await CompleteAsync(api, instanceId, 2).ConfigureAwait(true);
        Assert.Equal("waiting-effect", transitioned.GetProperty("status").GetString());
        Assert.Equal("notify", transitioned.GetProperty("activeStepKey").GetString());
        Assert.Equal(3, transitioned.GetProperty("version").GetInt64());
        Assert.Equal(3, await CountAuditEventsAsync(api, instanceId).ConfigureAwait(true));
    }

    private static async Task<JsonElement> StartAsync(WorkflowTestClient api, string managedName)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/environments/test/definitions/{managedName}/instances",
            "start-1");
        using HttpResponseMessage response = await SendAsync(api, request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task<Guid> SendStartAsync(
        WorkflowTestClient api,
        string managedName,
        string idempotencyKey)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/environments/test/definitions/{managedName}/instances",
            idempotencyKey);
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await CloneRootAsync(response).ConfigureAwait(false);
        return body.GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> SaveAsync(
        WorkflowTestClient api,
        Guid instanceId,
        string snapshot,
        string key,
        long version)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Put,
            $"/api/instances/{instanceId}/response",
            key,
            version);
        request.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage response = await SendAsync(api, request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task AssertStaleSaveFailsAsync(
        WorkflowTestClient api,
        Guid instanceId,
        string snapshot)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Put,
            $"/api/instances/{instanceId}/response",
            "stale-save",
            1);
        request.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage response = await SendAsync(api, request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.PreconditionFailed, response.StatusCode);
    }

    private static async Task<JsonElement> GetAsync(WorkflowTestClient api, Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(HttpMethod.Get, $"/api/instances/{instanceId}");
        using HttpResponseMessage response = await SendAsync(api, request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> CompleteAsync(
        WorkflowTestClient api,
        Guid instanceId,
        long version)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/complete",
            "complete-1",
            version);
        using HttpResponseMessage response = await SendAsync(api, request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await CloneRootAsync(response).ConfigureAwait(false);
    }

    private static async Task<int> CountAuditEventsAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Get,
            $"/api/instances/{instanceId}/audit");
        using HttpResponseMessage response = await SendAsync(api, request).ConfigureAwait(false);
        JsonElement events = await CloneRootAsync(response).ConfigureAwait(false);
        return events.GetArrayLength();
    }

    private static async Task<string> CreateCompletedSnapshotAsync(SurveyDefinition definition)
    {
        Survey survey = definition.CreateSurvey();
        survey.SetValue("fullName", KajayValue.From("Ada"));
        _ = await survey.AdvanceAsync().ConfigureAwait(false);
        Assert.True(survey.IsCompleted);
        return survey.CreateSnapshot().ToJson();
    }

    private static async Task<HttpResponseMessage> SendAsync(
        WorkflowTestClient api,
        HttpRequestMessage request)
    {
        return await api.SendAsync(request).ConfigureAwait(false);
    }

    private static async Task<JsonElement> CloneRootAsync(HttpResponseMessage response)
    {
        using JsonDocument document = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return document.RootElement.Clone();
    }
}
