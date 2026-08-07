using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Kajay.Cli.Authentication;
using Kajay.Cli.Promotion;

namespace Kajay.Cli.Tests;

public sealed class PromotionApplicationTests
{
    private const string Digest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    [Fact]
    public async Task PromotionUsesScopedTokensAndActivatesTheVerifiedDigest()
    {
        var handler = new PromotionHandler(Digest, compatible: true);
        using var client = new HttpClient(handler);
        var application = new PromotionApplication(client);

        PromotionResult result = await application.PromoteAsync(
            CreateRequest(activate: true),
            CancellationToken.None).ConfigureAwait(true);

        Assert.Equal(Digest, result.Digest);
        Assert.Equal("onboarding", result.ManagedDefinitionName);
        Assert.Equal(4, result.ActivationVersion);
        Assert.Equal("client_target", result.ApprovedBy);
        Assert.Equal(
            [
                "token:client_source:kajay:definition:manage",
                $"export:{Digest}:token-source",
                "token:client_target:kajay:definition:manage kajay:definition:promote kajay:definition:approve",
                "preflight:production:token-target",
                "install:token-target",
                $"activate:onboarding:{Digest}:3:token-target",
            ],
            handler.Events);
    }

    [Fact]
    public async Task IncompatiblePreflightDoesNotInstallOrActivate()
    {
        var handler = new PromotionHandler(Digest, compatible: false);
        using var client = new HttpClient(handler);
        var application = new PromotionApplication(client);

        PromotionException exception = await Assert.ThrowsAsync<PromotionException>(() =>
            application.PromoteAsync(
                CreateRequest(activate: false),
                CancellationToken.None)).ConfigureAwait(true);

        Assert.Equal("target-preflight-incompatible", exception.Code);
        Assert.DoesNotContain(handler.Events, item => item.StartsWith("install", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CustomEnvironmentPolicyAcquiresApprovalOnlyAfterPreflight()
    {
        var handler = new PromotionHandler(Digest, compatible: true, requiresApproval: true);
        using var client = new HttpClient(handler);
        var application = new PromotionApplication(client);

        _ = await application.PromoteAsync(
            CreateRequest(activate: true, includeApprovalScope: false, environment: "quality"),
            CancellationToken.None).ConfigureAwait(true);

        Assert.Equal(
            [
                "token:client_source:kajay:definition:manage",
                $"export:{Digest}:token-source",
                "token:client_target:kajay:definition:manage kajay:definition:promote",
                "preflight:quality:token-target",
                "token:client_target:kajay:definition:manage kajay:definition:promote kajay:definition:approve",
                "install:token-target",
                $"activate:onboarding:{Digest}:3:token-target",
            ],
            handler.Events);
    }

    private static PromotionRequest CreateRequest(
        bool activate,
        bool includeApprovalScope = true,
        string environment = "production")
    {
        string targetScope = "kajay:definition:manage kajay:definition:promote"
            + (activate && includeApprovalScope ? " kajay:definition:approve" : string.Empty);
        return new PromotionRequest(
            new Uri("https://source.example/workflow/"),
            new MachineIdentity(
                new Uri("https://identity.example/source/token"),
                "client_source",
                "source-secret",
                "kajay:definition:manage"),
            new Uri("https://target.example/workflow/"),
            new MachineIdentity(
                new Uri("https://identity.example/target/token"),
                "client_target",
                "target-secret",
                targetScope),
            Digest,
            environment,
            activate,
            activate ? 3 : null);
    }

    private sealed class PromotionHandler(
        string digest,
        bool compatible,
        bool requiresApproval = true) : HttpMessageHandler
    {
        internal List<string> Events { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            string host = request.RequestUri!.Host;
            string path = request.RequestUri.AbsolutePath;
            if (path.EndsWith("/token", StringComparison.Ordinal))
            {
                return await TokenAsync(request, cancellationToken).ConfigureAwait(false);
            }
            string token = request.Headers.Authorization?.Parameter ?? string.Empty;
            if (request.Method == HttpMethod.Get && path.EndsWith("/bundle", StringComparison.Ordinal))
            {
                Events.Add($"export:{digest}:{token}");
                return Bytes([1, 2, 3]);
            }
            if (path.EndsWith("/preflight", StringComparison.Ordinal))
            {
                string environment = request.RequestUri.Query["?environmentName=".Length..];
                Events.Add($"preflight:{environment}:{token}");
                return Json(new ReleasePreflightResponse(
                    digest,
                    "onboarding",
                    "1.2.3",
                    compatible,
                    compatible ? [] : ["crm"],
                    requiresApproval));
            }
            if (path.EndsWith("/install", StringComparison.Ordinal))
            {
                Events.Add($"install:{token}");
                return Json(new ReleaseInstallResponse(digest, "onboarding", "1.2.3", true));
            }
            Assert.Equal("target.example", host);
            long version = long.Parse(
                request.Headers.GetValues("If-Match").Single().Trim('"'),
                System.Globalization.CultureInfo.InvariantCulture);
            string[] segments = path.Split('/');
            string environmentName = segments[^3];
            string definition = segments[^1];
            var body = await request.Content!.ReadFromJsonAsync<ActivationBody>(
                cancellationToken: cancellationToken).ConfigureAwait(false);
            Events.Add($"activate:{definition}:{body!.ReleaseDigest}:{version}:token-target");
            return Json(new ActivationResponse(
                environmentName, definition, digest, version + 1, "client_target"));
        }

        private async Task<HttpResponseMessage> TokenAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            string body = await request.Content!.ReadAsStringAsync(cancellationToken)
                .ConfigureAwait(false);
            Dictionary<string, string> form = body.Split('&').ToDictionary(
                pair => Uri.UnescapeDataString(pair.Split('=')[0]),
                pair => Uri.UnescapeDataString(pair.Split('=')[1]).Replace('+', ' '),
                StringComparer.Ordinal);
            string clientId = form["client_id"];
            Events.Add($"token:{clientId}:{form["scope"]}");
            return Json(new
            {
                access_token = clientId == "client_source" ? "token-source" : "token-target",
                expires_in = 3600,
                token_type = "Bearer",
            });
        }

        private static HttpResponseMessage Json<T>(T value)
        {
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(value) };
        }

        private static HttpResponseMessage Bytes(byte[] value)
        {
            var content = new ByteArrayContent(value);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.kajay.bundle+zip");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = content };
        }
    }

    private sealed record ActivationBody(string ReleaseDigest);
}
