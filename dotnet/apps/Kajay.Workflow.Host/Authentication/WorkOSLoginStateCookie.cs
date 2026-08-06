using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSLoginStateCookie
{
    private const string CookieName = "kajay-workos-login-state";
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private readonly IDataProtector _protector;
    private readonly TimeProvider _timeProvider;
    private readonly WorkOSSessionOptions _options;

    public WorkOSLoginStateCookie(
        IDataProtectionProvider protectionProvider,
        TimeProvider timeProvider,
        WorkOSAuthenticationOptions options)
    {
        _protector = protectionProvider.CreateProtector(
            "Kajay.Workflow.Host.WorkOS.LoginState.v1");
        _timeProvider = timeProvider;
        _options = options.Session;
    }

    internal void Write(HttpContext context, string state, string codeVerifier)
    {
        DateTimeOffset expiresAt = _timeProvider.GetUtcNow().Add(Lifetime);
        var value = new WorkOSLoginState(state, codeVerifier, expiresAt.ToUnixTimeSeconds());
        string protectedValue = _protector.Protect(JsonSerializer.Serialize(value));
        context.Response.Cookies.Append(CookieName, protectedValue, CreateOptions(expiresAt));
    }

    internal bool TryConsume(HttpContext context, string state, out WorkOSLoginState? loginState)
    {
        string? protectedValue = context.Request.Cookies[CookieName];
        context.Response.Cookies.Delete(CookieName, CreateOptions(null));
        loginState = Unprotect(protectedValue);
        if (loginState is null
            || loginState.ExpiresAtUnixSeconds < _timeProvider.GetUtcNow().ToUnixTimeSeconds())
        {
            return false;
        }
        return FixedTimeEquals(loginState.State, state);
    }

    private WorkOSLoginState? Unprotect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        try
        {
            return JsonSerializer.Deserialize<WorkOSLoginState>(_protector.Unprotect(value));
        }
        catch (Exception exception) when (
            exception is CryptographicException or FormatException or JsonException)
        {
            return null;
        }
    }

    private CookieOptions CreateOptions(DateTimeOffset? expiresAt) => new()
    {
        Expires = expiresAt,
        HttpOnly = true,
        IsEssential = true,
        Path = "/auth/callback",
        SameSite = SameSiteMode.Lax,
        Secure = Uri.TryCreate(_options.CallbackUrl, UriKind.Absolute, out Uri? callback)
            && callback.Scheme == Uri.UriSchemeHttps,
    };

    private static bool FixedTimeEquals(string expected, string actual)
    {
        byte[] expectedBytes = Encoding.UTF8.GetBytes(expected);
        byte[] actualBytes = Encoding.UTF8.GetBytes(actual);
        return expectedBytes.Length == actualBytes.Length
            && CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
    }
}
