using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class SurveySubmissionFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task AcceptedSubmissionRemainsReadableAfterWorkflowAdvances()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"submission-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeEffect: true);
        var api = new WorkflowTestClient(fixture.Client, $"tenant-{suffix}");
        _ = await api.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(true);

        JsonElement started = await StartAsync(api, managedName).ConfigureAwait(true);
        Guid instanceId = started.GetProperty("id").GetGuid();
        string snapshot = await CreateCompletedSnapshotAsync(scenario.Survey).ConfigureAwait(true);
        _ = await SaveAsync(api, instanceId, snapshot).ConfigureAwait(true);
        _ = await SubmitAsync(api, instanceId).ConfigureAwait(true);
        _ = await SubmitAsync(api, instanceId).ConfigureAwait(true);

        JsonElement submissions = await GetSubmissionsAsync(api, instanceId).ConfigureAwait(true);
        JsonElement work = await GetWorkAsync(api, instanceId).ConfigureAwait(true);

        JsonElement submission = Assert.Single(submissions.EnumerateArray());
        Assert.Equal("survey", submission.GetProperty("stepKey").GetString());
        Assert.Equal(1, submission.GetProperty("attemptNumber").GetInt32());
        Assert.Equal(scenario.Survey.DefinitionDigest,
            submission.GetProperty("definitionDigest").GetString());
        Assert.Equal("Ada", submission.GetProperty("snapshot")
            .GetProperty("data").GetProperty("fullName").GetProperty("value").GetString());
        JsonElement resumes = work.GetProperty("resumes");
        Assert.Equal(2, resumes.GetArrayLength());
        Assert.Equal("start", resumes[0].GetProperty("kind").GetString());
        Assert.Equal("completed", resumes[0].GetProperty("status").GetString());
        Assert.Equal("survey", resumes[1].GetProperty("kind").GetString());
        Assert.Equal("completed", resumes[1].GetProperty("status").GetString());
    }

    private static async Task<JsonElement> StartAsync(WorkflowTestClient api, string managedName)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/environments/test/definitions/{managedName}/instances",
            "start-submission");
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        string responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
        Assert.True(
            response.StatusCode == HttpStatusCode.Created,
            $"Expected Created but received {response.StatusCode}: {responseBody}");
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> SaveAsync(
        WorkflowTestClient api,
        Guid instanceId,
        string snapshot)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Put,
            $"/api/instances/{instanceId}/response",
            "save-submission",
            1);
        request.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> SubmitAsync(WorkflowTestClient api, Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/complete",
            "submit-survey",
            2);
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> GetSubmissionsAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Get,
            $"/api/instances/{instanceId}/submissions");
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> GetWorkAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Get,
            $"/api/instances/{instanceId}/work");
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<string> CreateCompletedSnapshotAsync(SurveyDefinition definition)
    {
        Survey survey = definition.CreateSurvey();
        survey.SetValue("fullName", KajayValue.From("Ada"));
        _ = await survey.AdvanceAsync().ConfigureAwait(false);
        Assert.True(survey.IsCompleted);
        return survey.CreateSnapshot().ToJson();
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using JsonDocument document = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return document.RootElement.Clone();
    }
}
