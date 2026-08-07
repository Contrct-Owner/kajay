using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Kajay.Cli.Authentication;
using Kajay.Cli.Promotion;

namespace Kajay.Workflow.Host.Tests;

[Collection(WorkOSEmulateHostTestGroup.Name)]
public sealed class MachinePromotionFlowTests(WorkOSEmulateHostFixture fixture)
{
    private const string PromoterClient = "client_kajay_local_promotion";
    private const string PromoterSecret = "secret_kajay_local_promotion";
    private const string ActivatorClient = "client_kajay_local_activation";
    private const string ActivatorSecret = "secret_kajay_local_activation";
    private const string ManageScope = "kajay:definition:manage";
    private const string PromoteScope = "kajay:definition:promote";
    private const string ApproveScope = "kajay:definition:approve";

    [Fact]
    public async Task CliPromotesWithARealScopedWorkOSMachineToken()
    {
        string managedName = $"machine-{Guid.NewGuid():N}";
        byte[] bundle = KajayBundleFixture.Create(managedName);
        string promoterToken = await AcquireTokenAsync(
            PromoterClient,
            PromoterSecret,
            $"{ManageScope} {PromoteScope}").ConfigureAwait(true);
        string digest = await InstallAsync(bundle, promoterToken).ConfigureAwait(true);
        using var transport = new RoutingHttpMessageHandler(fixture.Client, fixture.EmulatorUri);
        using var client = new HttpClient(transport);
        var application = new PromotionApplication(client);
        MachineIdentity identity = Identity(
            PromoterClient,
            PromoterSecret,
            $"{ManageScope} {PromoteScope}");

        PromotionResult result = await application.PromoteAsync(
            new PromotionRequest(
                new Uri("http://source.workflow/"),
                identity with { Scope = ManageScope },
                new Uri("http://target.workflow/"),
                identity,
                digest,
                "test",
                Activate: true,
                ExpectedVersion: 0),
            CancellationToken.None).ConfigureAwait(true);

        Assert.Equal(digest, result.Digest);
        Assert.Equal(managedName, result.ManagedDefinitionName);
        Assert.False(result.Installed);
        Assert.Equal(1, result.ActivationVersion);
        Assert.Null(result.ApprovedBy);
    }

    [Fact]
    public async Task ProductionActivationRequiresTheSeparateApprovalMachine()
    {
        string managedName = $"approval-machine-{Guid.NewGuid():N}";
        string promoterToken = await AcquireTokenAsync(
            PromoterClient,
            PromoterSecret,
            $"{ManageScope} {PromoteScope}").ConfigureAwait(true);
        string digest = await InstallAsync(KajayBundleFixture.Create(managedName), promoterToken)
            .ConfigureAwait(true);

        using HttpResponseMessage forbidden = await ActivateAsync(
            managedName,
            digest,
            promoterToken).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        string activatorToken = await AcquireTokenAsync(
            ActivatorClient,
            ActivatorSecret,
            $"{PromoteScope} {ApproveScope}").ConfigureAwait(true);
        using HttpResponseMessage activated = await ActivateAsync(
            managedName,
            digest,
            activatorToken).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, activated.StatusCode);
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(activated)
            .ConfigureAwait(true);
        Assert.Equal(ActivatorClient, body.RootElement.GetProperty("approvedBy").GetString());
    }

    private MachineIdentity Identity(string clientId, string secret, string scope)
    {
        return new MachineIdentity(
            new Uri(fixture.EmulatorUri, "/oauth2/token"),
            clientId,
            secret,
            scope);
    }

    private async Task<string> AcquireTokenAsync(string clientId, string secret, string scope)
    {
        using var client = new HttpClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri(fixture.EmulatorUri, "/oauth2/token"))
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = clientId,
                ["client_secret"] = secret,
                ["grant_type"] = "client_credentials",
                ["scope"] = scope,
            }),
        };
        using HttpResponseMessage response = await client.SendAsync(request).ConfigureAwait(true);
        response.EnsureSuccessStatusCode();
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(true);
        return body.RootElement.GetProperty("access_token").GetString()!;
    }

    private async Task<string> InstallAsync(byte[] bundle, string accessToken)
    {
        using var request = Authorized(HttpMethod.Post, "/api/management/releases/install", accessToken);
        request.Content = new ByteArrayContent(bundle);
        request.Content.Headers.ContentType = new("application/vnd.kajay.bundle+zip");
        using HttpResponseMessage response = await fixture.Client.SendAsync(request)
            .ConfigureAwait(true);
        response.EnsureSuccessStatusCode();
        using JsonDocument body = await WorkflowTestClient.ReadJsonAsync(response)
            .ConfigureAwait(true);
        return body.RootElement.GetProperty("digest").GetString()!;
    }

    private async Task<HttpResponseMessage> ActivateAsync(
        string managedName,
        string digest,
        string accessToken)
    {
        using HttpRequestMessage request = Authorized(
            HttpMethod.Put,
            $"/api/management/environments/production/activations/{managedName}",
            accessToken);
        request.Headers.TryAddWithoutValidation("If-Match", "\"0\"");
        request.Content = JsonContent.Create(new { releaseDigest = digest });
        return await fixture.Client.SendAsync(request).ConfigureAwait(true);
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string uri, string accessToken)
    {
        var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return request;
    }

    private sealed class RoutingHttpMessageHandler(HttpClient workflow, Uri emulator)
        : HttpMessageHandler
    {
        private readonly HttpClient _emulator = new();

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            using HttpRequestMessage copy = await CopyAsync(request, cancellationToken)
                .ConfigureAwait(false);
            HttpClient destination = string.Equals(
                request.RequestUri!.Authority,
                emulator.Authority,
                StringComparison.OrdinalIgnoreCase)
                ? _emulator
                : workflow;
            return await destination.SendAsync(copy, cancellationToken).ConfigureAwait(false);
        }

        private static async Task<HttpRequestMessage> CopyAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var copy = new HttpRequestMessage(request.Method, request.RequestUri);
            foreach ((string name, IEnumerable<string> values) in request.Headers)
            {
                copy.Headers.TryAddWithoutValidation(name, values);
            }
            if (request.Content is not null)
            {
                copy.Content = new ByteArrayContent(
                    await request.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false));
                foreach ((string name, IEnumerable<string> values) in request.Content.Headers)
                {
                    copy.Content.Headers.TryAddWithoutValidation(name, values);
                }
            }
            return copy;
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _emulator.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
