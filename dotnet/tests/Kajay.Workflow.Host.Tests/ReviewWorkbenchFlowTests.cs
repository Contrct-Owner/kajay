using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkflowHostTestGroup.Name)]
public sealed class ReviewWorkbenchFlowTests(WorkflowHostFixture fixture)
{
    [Fact]
    public async Task ReviewerPagesOnlyTasksAssignedToTheirPermissions()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenantId = $"tenant-{suffix}";
        var respondent = new WorkflowTestClient(fixture.Client, tenantId, "respondent");
        var reviewer = new WorkflowTestClient(
            fixture.Client,
            tenantId,
            "level-one-reviewer",
            ["kajay:workflow:review", "kajay:workflow:review:level-1"]);

        _ = await CreatePendingReviewAsync(
            respondent, $"first-{suffix}", "kajay:workflow:review:level-1", "Ada")
            .ConfigureAwait(true);
        _ = await CreatePendingReviewAsync(
            respondent, $"second-{suffix}", "kajay:workflow:review:level-1", "Grace")
            .ConfigureAwait(true);
        _ = await CreatePendingReviewAsync(
            respondent, $"hidden-{suffix}", "kajay:workflow:review:level-2", "Katherine")
            .ConfigureAwait(true);

        JsonElement firstPage = await GetAsync(reviewer, "/api/reviews?status=pending&limit=1")
            .ConfigureAwait(true);
        JsonElement firstItem = Assert.Single(firstPage.GetProperty("items").EnumerateArray());
        Assert.Equal("kajay:workflow:review:level-1",
            firstItem.GetProperty("task").GetProperty("assignedPermission").GetString());
        string cursor = Assert.IsType<string>(firstPage.GetProperty("nextCursor").GetString());

        JsonElement secondPage = await GetAsync(
            reviewer,
            $"/api/reviews?status=pending&limit=1&cursor={Uri.EscapeDataString(cursor)}")
            .ConfigureAwait(true);
        JsonElement secondItem = Assert.Single(secondPage.GetProperty("items").EnumerateArray());
        Assert.NotEqual(
            firstItem.GetProperty("task").GetProperty("id").GetGuid(),
            secondItem.GetProperty("task").GetProperty("id").GetGuid());
        Assert.Equal(JsonValueKind.Null, secondPage.GetProperty("nextCursor").ValueKind);
    }

    [Fact]
    public async Task AssignedReviewerGetsThePinnedSubmissionDefinitionAndHistory()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string tenantId = $"tenant-{suffix}";
        string assignment = "kajay:workflow:review:level-1";
        var respondent = new WorkflowTestClient(fixture.Client, tenantId, "respondent");
        var reviewer = new WorkflowTestClient(
            fixture.Client,
            tenantId,
            "level-one-reviewer",
            ["kajay:workflow:review", assignment]);
        var unassigned = new WorkflowTestClient(
            fixture.Client,
            tenantId,
            "level-two-reviewer",
            ["kajay:workflow:review", "kajay:workflow:review:level-2"]);
        Guid instanceId = await CreatePendingReviewAsync(
            respondent, $"detail-{suffix}", assignment, "Ada Lovelace").ConfigureAwait(true);
        JsonElement page = await GetAsync(reviewer, "/api/reviews?status=pending")
            .ConfigureAwait(true);
        JsonElement item = Assert.Single(page.GetProperty("items").EnumerateArray());
        Guid taskId = item.GetProperty("task").GetProperty("id").GetGuid();

        JsonElement detail = await GetAsync(reviewer, $"/api/reviews/{taskId}")
            .ConfigureAwait(true);
        Assert.Equal(instanceId, detail.GetProperty("instance").GetProperty("id").GetGuid());
        Assert.Equal(
            detail.GetProperty("task").GetProperty("submissionId").GetGuid(),
            detail.GetProperty("submission").GetProperty("id").GetGuid());
        Assert.Equal("Onboarding", detail.GetProperty("definition").GetProperty("title").GetString());
        Assert.Single(detail.GetProperty("reviewRounds").EnumerateArray());
        Assert.Contains(
            detail.GetProperty("auditHistory").EnumerateArray(),
            item => item.GetProperty("eventType").GetString() == "survey-step-completed");

        using HttpRequestMessage request = unassigned.Create(
            HttpMethod.Get,
            $"/api/reviews/{taskId}");
        using HttpResponseMessage response = await unassigned.SendAsync(request)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CompletedFilterReturnsDecidedTasksForOneManagedDefinition()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string managedName = $"completed-{suffix}";
        var reviewer = new WorkflowTestClient(
            fixture.Client,
            $"tenant-{suffix}",
            "reviewer");
        Guid instanceId = await CreatePendingReviewAsync(
            reviewer, managedName, "kajay:workflow:review", "Dorothy")
            .ConfigureAwait(true);
        JsonElement pending = await GetAsync(
            reviewer,
            $"/api/reviews?managedDefinitionName={managedName}").ConfigureAwait(true);
        JsonElement item = Assert.Single(pending.GetProperty("items").EnumerateArray());
        Guid taskId = item.GetProperty("task").GetProperty("id").GetGuid();
        long version = item.GetProperty("workflowVersion").GetInt64();

        using HttpRequestMessage decision = reviewer.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/reviews/{taskId}/decisions",
            $"approve-{suffix}",
            version);
        decision.Content = JsonContent.Create(new { decision = "approve", comment = "Approved." });
        using HttpResponseMessage decided = await reviewer.SendAsync(decision).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, decided.StatusCode);

        JsonElement completed = await GetAsync(
            reviewer,
            $"/api/reviews?status=completed&managedDefinitionName={managedName}")
            .ConfigureAwait(true);
        JsonElement completedItem = Assert.Single(completed.GetProperty("items").EnumerateArray());
        Assert.Equal("approved",
            completedItem.GetProperty("task").GetProperty("status").GetString());
    }

    private static async Task<Guid> CreatePendingReviewAsync(
        WorkflowTestClient api,
        string managedName,
        string assignedPermission,
        string fullName)
    {
        KajayBundleScenario scenario = KajayBundleFixture.CreateScenario(
            managedName,
            includeReview: true,
            assignedReviewPermission: assignedPermission);
        _ = await api.InstallAndActivateAsync("test", managedName, scenario.Bundle)
            .ConfigureAwait(false);
        using HttpRequestMessage start = api.Create(
            HttpMethod.Post,
            $"/api/environments/test/definitions/{managedName}/instances",
            $"start-{managedName}");
        using HttpResponseMessage started = await api.SendAsync(start).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        JsonElement instance = await ReadAsync(started).ConfigureAwait(false);
        Guid instanceId = instance.GetProperty("id").GetGuid();
        string snapshot = await CreateSnapshotAsync(scenario.Survey, fullName).ConfigureAwait(false);

        using HttpRequestMessage save = api.Create(
            HttpMethod.Put,
            $"/api/instances/{instanceId}/response",
            $"save-{managedName}",
            instance.GetProperty("version").GetInt64());
        save.Content = JsonContent.Create(new { snapshot = JsonNode.Parse(snapshot) });
        using HttpResponseMessage saved = await api.SendAsync(save).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        instance = await ReadAsync(saved).ConfigureAwait(false);

        using HttpRequestMessage submit = api.Create(
            HttpMethod.Post,
            $"/api/instances/{instanceId}/complete",
            $"submit-{managedName}",
            instance.GetProperty("version").GetInt64());
        using HttpResponseMessage submitted = await api.SendAsync(submit).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        return instanceId;
    }

    private static async Task<string> CreateSnapshotAsync(
        SurveyDefinition definition,
        string fullName)
    {
        Survey survey = definition.CreateSurvey();
        survey.SetValue("fullName", KajayValue.From(fullName));
        _ = await survey.AdvanceAsync().ConfigureAwait(false);
        return survey.CreateSnapshot().ToJson();
    }

    private static async Task<JsonElement> GetAsync(WorkflowTestClient api, string path)
    {
        using HttpRequestMessage request = api.Create(HttpMethod.Get, path);
        using HttpResponseMessage response = await api.SendAsync(request).ConfigureAwait(false);
        string responseText = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
        Assert.True(
            response.StatusCode == HttpStatusCode.OK,
            $"Expected OK but received {response.StatusCode}: {responseText}");
        using JsonDocument document = JsonDocument.Parse(responseText);
        return document.RootElement.Clone();
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using JsonDocument document = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(false);
        return document.RootElement.Clone();
    }
}
