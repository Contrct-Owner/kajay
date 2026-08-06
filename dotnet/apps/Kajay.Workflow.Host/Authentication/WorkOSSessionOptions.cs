namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSSessionOptions
{
    public bool Enabled { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    public string BrowserBaseUrl { get; set; } = "https://api.workos.com";

    public string CallbackUrl { get; set; } = "https://localhost:5082/auth/callback";

    public string PostLoginRedirectUrl { get; set; } = "https://localhost:5082/auth/session";

    public string PostLogoutRedirectUrl { get; set; } = "https://localhost:5082/health";

    public string? DataProtectionKeysPath { get; set; }
}
