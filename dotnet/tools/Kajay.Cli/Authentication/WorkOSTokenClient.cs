using System.Net.Http.Json;
using System.Text.Json;

namespace Kajay.Cli.Authentication;

internal sealed class WorkOSTokenClient(HttpClient httpClient)
{
    internal async Task<string> AcquireAsync(
        MachineIdentity identity,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, identity.TokenEndpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = identity.ClientId,
                ["client_secret"] = identity.ClientSecret,
                ["grant_type"] = "client_credentials",
                ["scope"] = identity.Scope,
            }),
        };
        using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken)
            .ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw await PromotionException.FromResponseAsync(
                "token-acquisition",
                response,
                cancellationToken).ConfigureAwait(false);
        }
        WorkOSAccessToken token;
        try
        {
            token = await response.Content
                .ReadFromJsonAsync<WorkOSAccessToken>(cancellationToken: cancellationToken)
                .ConfigureAwait(false)
                ?? throw new PromotionException("token-response-invalid", "WorkOS returned no token.");
        }
        catch (JsonException exception)
        {
            throw new PromotionException(
                "token-response-invalid",
                $"WorkOS returned invalid token JSON: {exception.Message}");
        }
        if (!string.Equals(token.TokenType, "Bearer", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(token.AccessToken))
        {
            throw new PromotionException(
                "token-response-invalid",
                "WorkOS returned an invalid bearer token response.");
        }
        return token.AccessToken;
    }
}
