using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Cli.Promotion;

internal sealed class WorkflowHostClient(HttpClient httpClient, Uri host, string accessToken)
{
    private const int MaximumBundleBytes = 10 * 1024 * 1024;

    internal async Task<byte[]> ExportAsync(
        string releaseDigest,
        CancellationToken cancellationToken)
    {
        using HttpRequestMessage request = Create(
            HttpMethod.Get,
            $"api/management/releases/{Uri.EscapeDataString(releaseDigest)}/bundle");
        using HttpResponseMessage response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        await EnsureSuccessAsync("source-export", response, cancellationToken)
            .ConfigureAwait(false);
        if (response.Content.Headers.ContentLength is > MaximumBundleBytes)
        {
            throw new PromotionException("source-bundle-too-large", "The source bundle exceeds 10 MiB.");
        }
        await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken)
            .ConfigureAwait(false);
        using var output = new MemoryStream();
        await CopyBundleAsync(stream, output, cancellationToken).ConfigureAwait(false);
        return output.ToArray();
    }

    internal Task<ReleasePreflightResponse> PreflightAsync(
        string environmentName,
        byte[] bundle,
        CancellationToken cancellationToken)
    {
        string environment = Uri.EscapeDataString(environmentName);
        return SendBundleAsync<ReleasePreflightResponse>(
            "target-preflight",
            $"api/management/releases/preflight?environmentName={environment}",
            bundle,
            cancellationToken);
    }

    internal Task<ReleaseInstallResponse> InstallAsync(
        byte[] bundle,
        CancellationToken cancellationToken)
    {
        return SendBundleAsync<ReleaseInstallResponse>(
            "target-install",
            "api/management/releases/install",
            bundle,
            cancellationToken);
    }

    internal async Task<ActivationResponse> ActivateAsync(
        string environmentName,
        string managedDefinitionName,
        string releaseDigest,
        long expectedVersion,
        CancellationToken cancellationToken)
    {
        string environment = Uri.EscapeDataString(environmentName);
        string definition = Uri.EscapeDataString(managedDefinitionName);
        using HttpRequestMessage request = Create(
            HttpMethod.Put,
            $"api/management/environments/{environment}/activations/{definition}");
        request.Headers.TryAddWithoutValidation("If-Match", $"\"{expectedVersion}\"");
        request.Content = JsonContent.Create(new { releaseDigest });
        using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken)
            .ConfigureAwait(false);
        await EnsureSuccessAsync("target-activation", response, cancellationToken)
            .ConfigureAwait(false);
        return await ReadRequiredAsync<ActivationResponse>(response, cancellationToken)
            .ConfigureAwait(false);
    }

    private HttpRequestMessage Create(HttpMethod method, string path)
    {
        Uri baseUri = host.AbsoluteUri.EndsWith('/')
            ? host
            : new Uri($"{host.AbsoluteUri}/");
        var request = new HttpRequestMessage(method, new Uri(baseUri, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return request;
    }

    private async Task<T> SendBundleAsync<T>(
        string phase,
        string path,
        byte[] bundle,
        CancellationToken cancellationToken)
    {
        using HttpRequestMessage request = Create(HttpMethod.Post, path);
        request.Content = new ByteArrayContent(bundle);
        request.Content.Headers.ContentType = new("application/vnd.kajay.bundle+zip");
        using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken)
            .ConfigureAwait(false);
        await EnsureSuccessAsync(phase, response, cancellationToken).ConfigureAwait(false);
        return await ReadRequiredAsync<T>(response, cancellationToken).ConfigureAwait(false);
    }

    private static async Task<T> ReadRequiredAsync<T>(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken: cancellationToken)
                .ConfigureAwait(false)
                ?? throw new PromotionException(
                    "host-response-invalid",
                    "The workflow host returned no result.");
        }
        catch (JsonException exception)
        {
            throw new PromotionException(
                "host-response-invalid",
                $"The workflow host returned invalid JSON: {exception.Message}");
        }
    }

    private static async Task EnsureSuccessAsync(
        string phase,
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        if (!response.IsSuccessStatusCode)
        {
            throw await PromotionException.FromResponseAsync(phase, response, cancellationToken)
                .ConfigureAwait(false);
        }
    }

    private static async Task CopyBundleAsync(
        Stream input,
        Stream output,
        CancellationToken cancellationToken)
    {
        byte[] buffer = new byte[81920];
        while (true)
        {
            int read = await input.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (read == 0)
            {
                return;
            }
            if (output.Length > MaximumBundleBytes - read)
            {
                throw new PromotionException(
                    "source-bundle-too-large",
                    "The source bundle exceeds 10 MiB.");
            }
            await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken)
                .ConfigureAwait(false);
        }
    }
}
