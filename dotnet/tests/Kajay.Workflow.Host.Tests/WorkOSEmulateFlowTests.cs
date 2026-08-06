using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkOSEmulateHostTestGroup.Name)]
public sealed class WorkOSEmulateFlowTests(WorkOSEmulateHostFixture fixture)
{
    [Fact]
    public async Task InteractiveLoginIssuesAnAuthorizedHostSession()
    {
        string sessionCookie = await LoginAsync("admin@kajay.local").ConfigureAwait(true);
        using JsonDocument body = await ReadSessionAsync(sessionCookie).ConfigureAwait(true);
        Assert.Equal(
            "user_kajay_local_admin",
            body.RootElement.GetProperty("subject").GetString());
        Assert.Equal("org_kajay_local", body.RootElement.GetProperty("organizationId").GetString());
        Assert.Contains(
            body.RootElement.GetProperty("permissions").EnumerateArray(),
            permission => permission.GetString() == "kajay:definition:approve");

        using var logoutRequest = new HttpRequestMessage(HttpMethod.Post, "/auth/logout");
        logoutRequest.Headers.Add("Cookie", sessionCookie);
        using HttpResponseMessage logout = await fixture.Client.SendAsync(logoutRequest)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Redirect, logout.StatusCode);
        Assert.StartsWith(
            fixture.EmulatorUri.GetLeftPart(UriPartial.Authority),
            logout.Headers.Location?.ToString(),
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task SeededRolesIssueTheirExactKajayPermissions()
    {
        var expected = new Dictionary<string, string[]>
        {
            ["approver@kajay.local"] =
                ["kajay:definition:approve", "kajay:definition:promote", "kajay:workflow:read"],
            ["author@kajay.local"] =
                ["kajay:definition:manage", "kajay:definition:promote", "kajay:workflow:read"],
            ["operator@kajay.local"] =
                ["kajay:workflow:execute", "kajay:workflow:read"],
        };
        foreach ((string email, string[] permissions) in expected)
        {
            string cookie = await LoginAsync(email).ConfigureAwait(true);
            using JsonDocument session = await ReadSessionAsync(cookie).ConfigureAwait(true);
            string[] actual = session.RootElement.GetProperty("permissions")
                .EnumerateArray()
                .Select(permission => permission.GetString()!)
                .ToArray();
            Assert.Equal(permissions, actual);
        }
    }

    private async Task<string> LoginAsync(string email)
    {
        string escapedEmail = Uri.EscapeDataString(email);
        using HttpResponseMessage login = await fixture.Client
            .GetAsync($"/auth/login?loginHint={escapedEmail}").ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Redirect, login.StatusCode);
        string correlationCookie = ReadCookie(login, "kajay-workos-login-state");
        Uri authorizationUrl = login.Headers.Location!;
        using var emulator = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
        using HttpResponseMessage loginPage = await emulator.GetAsync(authorizationUrl)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, loginPage.StatusCode);
        using HttpResponseMessage authorization = await emulator.PostAsync(
            new Uri(fixture.EmulatorUri, "/user_management/authorize"),
            CreateAuthorizationForm(authorizationUrl, email)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Redirect, authorization.StatusCode);
        using var callbackRequest = new HttpRequestMessage(
            HttpMethod.Get,
            authorization.Headers.Location!.PathAndQuery);
        callbackRequest.Headers.Add("Cookie", correlationCookie);
        using HttpResponseMessage completed = await fixture.Client.SendAsync(callbackRequest)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Redirect, completed.StatusCode);
        return ReadCookie(completed, "kajay-workos-session");
    }

    private async Task<JsonDocument> ReadSessionAsync(string sessionCookie)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/auth/session");
        request.Headers.Add("Cookie", sessionCookie);
        using HttpResponseMessage response = await fixture.Client.SendAsync(request)
            .ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync().ConfigureAwait(true)).ConfigureAwait(true);
    }

    private static FormUrlEncodedContent CreateAuthorizationForm(
        Uri authorizationUrl,
        string email)
    {
        Dictionary<string, Microsoft.Extensions.Primitives.StringValues> query =
            QueryHelpers.ParseQuery(authorizationUrl.Query);
        var values = new Dictionary<string, string>
        {
            ["client_id"] = ReadQuery(query, "client_id"),
            ["code_challenge"] = ReadQuery(query, "code_challenge"),
            ["code_challenge_method"] = ReadQuery(query, "code_challenge_method"),
            ["email"] = email,
            ["redirect_uri"] = ReadQuery(query, "redirect_uri"),
            ["state"] = ReadQuery(query, "state"),
        };
        return new FormUrlEncodedContent(values);
    }

    private static string ReadQuery(
        Dictionary<string, Microsoft.Extensions.Primitives.StringValues> query,
        string name)
    {
        Assert.True(query.TryGetValue(name, out Microsoft.Extensions.Primitives.StringValues value));
        return value.ToString();
    }

    private static string ReadCookie(HttpResponseMessage response, string name)
    {
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out IEnumerable<string>? headers));
        string prefix = $"{name}=";
        string header = Assert.Single(headers, value => value.StartsWith(prefix, StringComparison.Ordinal));
        return header[..header.IndexOf(';')];
    }
}
