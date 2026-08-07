using System.Net;
using System.Text.Json;

namespace Kajay.Cli;

internal sealed class PromotionException : Exception
{
    internal PromotionException(string code, string message, HttpStatusCode? statusCode = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }

    internal string Code { get; }

    internal HttpStatusCode? StatusCode { get; }

    internal static async Task<PromotionException> FromResponseAsync(
        string phase,
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        string body = await response.Content.ReadAsStringAsync(cancellationToken)
            .ConfigureAwait(false);
        string? remoteCode = null;
        string? detail = null;
        try
        {
            using JsonDocument document = JsonDocument.Parse(body);
            JsonElement root = document.RootElement;
            remoteCode = ReadString(root, "code");
            detail = ReadString(root, "detail") ?? ReadString(root, "error_description");
        }
        catch (JsonException)
        {
            // Non-JSON error bodies are deliberately not reflected into terminal output.
        }
        string code = remoteCode is null ? $"{phase}-failed" : $"{phase}:{remoteCode}";
        string message = detail ?? $"{phase} failed with HTTP {(int)response.StatusCode}.";
        return new PromotionException(code, message, response.StatusCode);
    }

    private static string? ReadString(JsonElement root, string propertyName)
    {
        return root.ValueKind == JsonValueKind.Object
            && root.TryGetProperty(propertyName, out JsonElement property)
            && property.ValueKind == JsonValueKind.String
                ? property.GetString()
                : null;
    }
}
