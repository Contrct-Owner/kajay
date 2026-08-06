using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay.Demo.Api;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Kajay.Demo.Api.Tests;

public sealed class DemoApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public DemoApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task DefinitionIsCanonicalizedByDotnetSdk()
    {
        DemoDefinitionResult result = await GetDefinitionAsync();

        Assert.Equal("dotnet", result.Runtime);
        Assert.True(result.Accepted);
        Assert.NotNull(result.Definition);
        Assert.Empty(result.Diagnostics);
        Assert.Equal(1, result.Definition["schemaVersion"]?.GetValue<int>());
    }

    [Fact]
    public async Task SubmissionRunsLifecycleCalculationAndQuizScoring()
    {
        DemoDefinitionResult definition = await GetDefinitionAsync();
        var body = new
        {
            definition = definition.Definition,
            data = new
            {
                name = "Ada",
                email = "ada@example.com",
                role = "Engineer",
                rating = 5,
            },
        };

        HttpResponseMessage response = await _client.PostAsJsonAsync("/api/demo/submissions", body);
        DemoSubmissionResult result = await ReadAsync<DemoSubmissionResult>(response);

        Assert.True(result.Accepted);
        Assert.True(result.Completed);
        Assert.Equal("advanced", result.Outcome);
        JsonElement profileComplete = Assert.IsType<JsonElement>(result.Data["profileComplete"]);
        Assert.True(profileComplete.GetBoolean());
        Assert.Equal(1, result.Score.Earned);
        Assert.Equal(1, result.Score.Possible);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public async Task HostServerValidatorCanBlockSubmission()
    {
        DemoDefinitionResult definition = await GetDefinitionAsync();
        var body = new
        {
            definition = definition.Definition,
            data = new { name = "Ada", email = "blocked@example.com", rating = 5 },
        };

        HttpResponseMessage response = await _client.PostAsJsonAsync("/api/demo/submissions", body);
        DemoSubmissionResult result = await ReadAsync<DemoSubmissionResult>(response);

        Assert.False(result.Accepted);
        Assert.False(result.Completed);
        Assert.Equal("blocked", result.Outcome);
        DemoSubmissionError error = Assert.Single(result.Errors);
        Assert.Equal(("email", "server"), (error.Name, error.Kind));
    }

    [Fact]
    public async Task AnswerValidationBlocksInsideTheRequestedNavigationGate()
    {
        var body = new
        {
            data = new { email = "blocked@example.com" },
            questionNames = new[] { "email" },
        };

        HttpResponseMessage response = await _client.PostAsJsonAsync(
            "/api/demo/answers/validate",
            body);
        DemoAnswerValidationResult result = await ReadAsync<DemoAnswerValidationResult>(response);

        DemoSubmissionError error = Assert.Single(result.Errors);
        Assert.Equal(("email", "server"), (error.Name, error.Kind));
    }

    [Fact]
    public async Task InvalidDefinitionReturnsDiagnosticsWithoutStartingRuntime()
    {
        JsonNode definition = JsonNode.Parse(
            """{"pages":[{"name":"p","elements":[{"type":"unknown","name":"q"}]}]}""")!;

        HttpResponseMessage response = await _client.PostAsJsonAsync(
            "/api/demo/definitions/validate",
            new { definition });
        DemoDefinitionResult result = await ReadAsync<DemoDefinitionResult>(response);

        Assert.False(result.Accepted);
        Assert.Contains(result.Diagnostics, diagnostic => diagnostic.Severity == "error");
    }

    [Fact]
    public async Task OpenApiDocumentDescribesDemoOperations()
    {
        string document = await _client.GetStringAsync("/openapi/v1.json");

        Assert.Contains("/api/demo/definition", document, StringComparison.Ordinal);
        Assert.Contains("/api/demo/submissions", document, StringComparison.Ordinal);
    }

    private async Task<DemoDefinitionResult> GetDefinitionAsync()
    {
        HttpResponseMessage response = await _client.GetAsync("/api/demo/definition");
        return await ReadAsync<DemoDefinitionResult>(response);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        T? result = await response.Content.ReadFromJsonAsync<T>(new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });
        return result ?? throw new JsonException($"Expected a {typeof(T).Name} response.");
    }
}
