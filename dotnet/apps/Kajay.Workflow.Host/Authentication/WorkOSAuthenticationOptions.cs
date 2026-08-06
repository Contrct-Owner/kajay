namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSAuthenticationOptions
{
    internal const string SectionName = "WorkOS";

    public string ClientId { get; set; } = string.Empty;

    public string? Audience { get; set; }

    public string Issuer { get; set; } = "https://api.workos.com/";

    public string ApiBaseUrl { get; set; } = "https://api.workos.com";

    public bool RequireHttpsMetadata { get; set; } = true;

    public WorkOSSessionOptions Session { get; set; } = new();
}
