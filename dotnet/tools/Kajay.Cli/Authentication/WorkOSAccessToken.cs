using System.Text.Json.Serialization;

namespace Kajay.Cli.Authentication;

internal sealed record WorkOSAccessToken
{
    [JsonPropertyName("access_token")]
    public required string AccessToken { get; init; }

    [JsonPropertyName("expires_in")]
    public required int ExpiresIn { get; init; }

    [JsonPropertyName("scope")]
    public string? Scope { get; init; }

    [JsonPropertyName("token_type")]
    public required string TokenType { get; init; }
}
