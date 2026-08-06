using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class DurableWorkerFlowTests(WorkflowHostFixture fixture)
{
    private static readonly TimeSpan WorkerCompletionTimeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task FailedEffectMovesToDeadLetterAfterConfiguredAttempts()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"failure-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeEffect: true);
        await using WorkflowWorkerHost host = fixture.CreateWorkerHost(
            new FailingWorkflowEffectHandler(),
            maximumAttempts: 1);
        var api = new WorkflowTestClient(host.Client, $"tenant-{suffix}");
        _ = await api.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(true);

        Guid instanceId = await StartAsync(api, managedName).ConfigureAwait(true);
        string snapshot = await CreateCompletedSnapshotAsync(scenario.Survey).ConfigureAwait(true);
        await SaveAsync(api, instanceId, snapshot).ConfigureAwait(true);
        await CompleteAsync(api, instanceId).ConfigureAwait(true);

        JsonElement delivery = await WaitForDeadLetterAsync(api, instanceId).ConfigureAwait(true);
        Assert.Equal(1, delivery.GetProperty("attempts").GetInt32());
        Assert.Contains(
            "rejected by the test adapter",
            delivery.GetProperty("lastError").GetString(),
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task DelayAndEffectResumeToCompletionThroughDurableWorkers()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"durable-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeEffect: true,
            delaySeconds: 0.1);
        await using WorkflowWorkerHost host = fixture.CreateWorkerHost();
        var api = new WorkflowTestClient(host.Client, $"tenant-{suffix}");
        _ = await api.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(true);

        Guid instanceId = await StartAsync(api, managedName).ConfigureAwait(true);
        string snapshot = await CreateCompletedSnapshotAsync(scenario.Survey).ConfigureAwait(true);
        await SaveAsync(api, instanceId, snapshot).ConfigureAwait(true);
        await CompleteAsync(api, instanceId).ConfigureAwait(true);

        JsonElement completed = await WaitForCompletionAsync(api, instanceId).ConfigureAwait(true);
        Assert.Equal("end", completed.GetProperty("activeStepKey").GetString());
        Assert.Equal(5, completed.GetProperty("version").GetInt64());
        Assert.Equal(5, await CountAuditEventsAsync(api, instanceId).ConfigureAwait(true));
    }

    private static async Task<Guid> StartAsync(WorkflowTestClient api, string managedName)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/environments/test/definitions/{managedName}/instances",
            "start-durable");
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return body.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task SaveAsync(
        WorkflowTestClient api,
        Guid instanceId,
        string snapshot)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Put,
            $"/api/instances/{instanceId}/response",
            "save-durable",
            1);
        request.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    private static async Task CompleteAsync(WorkflowTestClient api, Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/complete",
            "complete-durable",
            2);
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    private static async Task<JsonElement> WaitForCompletionAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using var timeout = new CancellationTokenSource(WorkerCompletionTimeout);
        while (true)
        {
            using HttpRequestMessage request = api.Create(
                HttpMethod.Get,
                $"/api/instances/{instanceId}");
            using HttpResponseMessage response = await api.SendAsync(request, timeout.Token)
                .ConfigureAwait(false);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
                .ConfigureAwait(false);
            JsonElement result = body.RootElement.Clone();
            if (string.Equals(
                result.GetProperty("status").GetString(),
                "completed",
                StringComparison.Ordinal))
            {
                return result;
            }
            await Task.Delay(TimeSpan.FromMilliseconds(50), timeout.Token).ConfigureAwait(false);
        }
    }

    private static async Task<int> CountAuditEventsAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Get,
            $"/api/instances/{instanceId}/audit");
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return body.RootElement.GetArrayLength();
    }

    private static async Task<JsonElement> WaitForDeadLetterAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using var timeout = new CancellationTokenSource(WorkerCompletionTimeout);
        while (true)
        {
            using HttpRequestMessage request = api.Create(
                HttpMethod.Get,
                $"/api/instances/{instanceId}/work");
            using HttpResponseMessage response = await api.SendAsync(request, timeout.Token)
                .ConfigureAwait(false);
            using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
                .ConfigureAwait(false);
            JsonElement effects = body.RootElement.GetProperty("effects");
            if (effects.GetArrayLength() != 0
                && string.Equals(
                    effects[0].GetProperty("status").GetString(),
                    "dead-letter",
                    StringComparison.Ordinal))
            {
                return effects[0].Clone();
            }
            await Task.Delay(TimeSpan.FromMilliseconds(50), timeout.Token).ConfigureAwait(false);
        }
    }

    private static async Task<string> CreateCompletedSnapshotAsync(SurveyDefinition definition)
    {
        Survey survey = definition.CreateSurvey();
        survey.SetValue("fullName", KajayValue.From("Grace"));
        _ = await survey.AdvanceAsync().ConfigureAwait(false);
        Assert.True(survey.IsCompleted);
        return survey.CreateSnapshot().ToJson();
    }
}
