using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class HumanReviewFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task ReviewerCanRequestChangesThenApproveTheNextSubmission()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenantId = $"tenant-{suffix}";
        string managedName = $"review-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeReview: true);
        var respondent = new WorkflowTestClient(fixture.Client, tenantId, "respondent");
        var reviewer = new WorkflowTestClient(fixture.Client, tenantId, "level-one-reviewer");
        _ = await respondent.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(true);

        JsonElement instance = await StartAsync(respondent, managedName).ConfigureAwait(true);
        Assert.Equal("active", instance.GetProperty("status").GetString());
        Guid instanceId = instance.GetProperty("id").GetGuid();
        instance = await SubmitAttemptAsync(
            respondent,
            scenario.Survey,
            instanceId,
            instance.GetProperty("version").GetInt64(),
            "Ada").ConfigureAwait(true);

        Assert.Equal("waiting-review", instance.GetProperty("status").GetString());
        JsonElement firstTask = Assert.Single(
            (await GetReviewsAsync(reviewer, instanceId).ConfigureAwait(true)).EnumerateArray());
        Assert.Equal("pending", firstTask.GetProperty("status").GetString());
        Assert.Equal(1, firstTask.GetProperty("roundNumber").GetInt32());
        Assert.Equal("kajay:workflow:review",
            firstTask.GetProperty("assignedPermission").GetString());

        instance = await DecideAsync(
            reviewer,
            instanceId,
            firstTask.GetProperty("id").GetGuid(),
            instance.GetProperty("version").GetInt64(),
            "request-changes",
            "Please use your legal name.").ConfigureAwait(true);
        Assert.Equal("active", instance.GetProperty("status").GetString());
        Assert.Equal("survey", instance.GetProperty("activeStepKey").GetString());

        instance = await SubmitAttemptAsync(
            respondent,
            scenario.Survey,
            instanceId,
            instance.GetProperty("version").GetInt64(),
            "Ada Lovelace").ConfigureAwait(true);
        JsonElement[] tasks = (await GetReviewsAsync(reviewer, instanceId).ConfigureAwait(true))
            .EnumerateArray().ToArray();
        Assert.Equal(2, tasks.Length);
        Assert.Equal("changes-requested", tasks[0].GetProperty("status").GetString());
        Assert.Equal("level-one-reviewer", tasks[0].GetProperty("decidedBy").GetString());
        Assert.Equal(2, tasks[1].GetProperty("roundNumber").GetInt32());

        long approvalVersion = instance.GetProperty("version").GetInt64();
        instance = await DecideAsync(
            reviewer,
            instanceId,
            tasks[1].GetProperty("id").GetGuid(),
            approvalVersion,
            "approve",
            "Ready to proceed.").ConfigureAwait(true);
        Assert.Equal("completed", instance.GetProperty("status").GetString());
        JsonElement repeated = await DecideAsync(
            reviewer,
            instanceId,
            tasks[1].GetProperty("id").GetGuid(),
            approvalVersion,
            "approve",
            "Ready to proceed.").ConfigureAwait(true);
        Assert.Equal(instance.GetProperty("version").GetInt64(),
            repeated.GetProperty("version").GetInt64());

        using HttpRequestMessage auditRequest = reviewer.Create(
            HttpMethod.Get,
            $"/api/instances/{instanceId}/audit");
        using HttpResponseMessage auditResponse = await reviewer.SendAsync(auditRequest)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, auditResponse.StatusCode);
        JsonElement audit = await ReadAsync(auditResponse).ConfigureAwait(true);
        JsonElement decisionEvent = audit.EnumerateArray().Last(item =>
            item.GetProperty("eventType").GetString() == "review-decision-recorded");
        Assert.Equal("level-one-reviewer", decisionEvent.GetProperty("actorId").GetString());
        Assert.Equal("approved",
            decisionEvent.GetProperty("payload").GetProperty("decision").GetString());

        JsonElement submissions = await GetSubmissionsAsync(respondent, instanceId)
            .ConfigureAwait(true);
        Assert.Equal(2, submissions.GetArrayLength());
        Assert.Equal(1, submissions[0].GetProperty("attemptNumber").GetInt32());
        Assert.Equal(2, submissions[1].GetProperty("attemptNumber").GetInt32());
    }

    [Fact]
    public async Task ReviewerCanDenyASubmission()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"denial-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeReview: true);
        var api = new WorkflowTestClient(fixture.Client, $"tenant-{suffix}", "reviewer");
        _ = await api.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(true);

        JsonElement instance = await StartAsync(api, managedName).ConfigureAwait(true);
        Guid instanceId = instance.GetProperty("id").GetGuid();
        instance = await SubmitAttemptAsync(
            api,
            scenario.Survey,
            instanceId,
            instance.GetProperty("version").GetInt64(),
            "Grace").ConfigureAwait(true);
        JsonElement task = Assert.Single(
            (await GetReviewsAsync(api, instanceId).ConfigureAwait(true)).EnumerateArray());

        instance = await DecideAsync(
            api,
            instanceId,
            task.GetProperty("id").GetGuid(),
            instance.GetProperty("version").GetInt64(),
            "deny",
            "Does not meet the criteria.").ConfigureAwait(true);

        Assert.Equal("completed", instance.GetProperty("status").GetString());
        task = Assert.Single(
            (await GetReviewsAsync(api, instanceId).ConfigureAwait(true)).EnumerateArray());
        Assert.Equal("denied", task.GetProperty("status").GetString());
    }

    [Fact]
    public async Task DecisionRequiresTheReviewPermission()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenantId = $"tenant-{suffix}";
        string managedName = $"authorization-{suffix}";
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeReview: true);
        var respondent = new WorkflowTestClient(fixture.Client, tenantId, "respondent");
        var unassigned = new WorkflowTestClient(
            fixture.Client,
            tenantId,
            "unassigned",
            ["kajay:workflow:read", "kajay:workflow:execute"]);
        _ = await respondent.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(true);
        JsonElement instance = await StartAsync(respondent, managedName).ConfigureAwait(true);
        Guid instanceId = instance.GetProperty("id").GetGuid();
        instance = await SubmitAttemptAsync(
            respondent,
            scenario.Survey,
            instanceId,
            instance.GetProperty("version").GetInt64(),
            "Katherine").ConfigureAwait(true);
        JsonElement task = Assert.Single(
            (await GetReviewsAsync(respondent, instanceId).ConfigureAwait(true)).EnumerateArray());

        using HttpRequestMessage request = unassigned.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/reviews/{task.GetProperty("id").GetGuid()}/decisions",
            $"unauthorized-{suffix}",
            instance.GetProperty("version").GetInt64());
        request.Content = JsonContent.Create(new { decision = "approve" });
        using HttpResponseMessage response = await unassigned.SendAsync(request)
            .ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static async Task<JsonElement> StartAsync(
        WorkflowTestClient api,
        string managedName)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/environments/test/definitions/{managedName}/instances",
            $"start-{managedName}");
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> SubmitAttemptAsync(
        WorkflowTestClient api,
        SurveyDefinition definition,
        Guid instanceId,
        long version,
        string fullName)
    {
        string snapshot = await CreateCompletedSnapshotAsync(definition, fullName)
            .ConfigureAwait(false);
        using HttpRequestMessage save = api.Create(
            HttpMethod.Put,
            $"/api/instances/{instanceId}/response",
            $"save-{version}",
            version);
        save.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage saved = await api.SendAsync(save).ConfigureAwait(false);
        string savedText = await saved.Content.ReadAsStringAsync().ConfigureAwait(false);
        Assert.True(
            saved.StatusCode == HttpStatusCode.OK,
            $"Expected OK but received {saved.StatusCode}: {savedText}");
        JsonElement savedBody = await ReadAsync(saved).ConfigureAwait(false);

        using HttpRequestMessage submit = api.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/complete",
            $"submit-{version}",
            savedBody.GetProperty("version").GetInt64());
        using HttpResponseMessage submitted = await api.SendAsync(submit).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        return await ReadAsync(submitted).ConfigureAwait(false);
    }

    private static async Task<JsonElement> DecideAsync(
        WorkflowTestClient api,
        Guid instanceId,
        Guid taskId,
        long version,
        string decision,
        string comment)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/reviews/{taskId}/decisions",
            $"review-{taskId:N}",
            version);
        request.Content = JsonContent.Create(new { decision, comment });
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response).ConfigureAwait(false);
    }

    private static async Task<JsonElement> GetReviewsAsync(
        WorkflowTestClient api,
        Guid instanceId)
    {
        using HttpRequestMessage request = api.Create(
            HttpMethod.Get,
            $"/api/instances/{instanceId}/reviews");
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

    private static async Task<string> CreateCompletedSnapshotAsync(
        SurveyDefinition definition,
        string fullName)
    {
        Survey survey = definition.CreateSurvey();
        survey.SetValue("fullName", KajayValue.From(fullName));
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
