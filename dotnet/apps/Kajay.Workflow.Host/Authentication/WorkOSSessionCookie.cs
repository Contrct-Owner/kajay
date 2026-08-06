using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.JsonWebTokens;
using WorkOS;

namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSSessionCookie
{
    private const string CookieName = "kajay-workos-session";
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);
    private static readonly TimeSpan RefreshWindow = TimeSpan.FromMinutes(1);
    private static readonly Action<ILogger, Exception?> LogRefreshRejected = LoggerMessage.Define(
        LogLevel.Information,
        new EventId(1, nameof(LogRefreshRejected)),
        "The WorkOS browser session could not be refreshed.");
    private static readonly Action<ILogger, Exception?> LogRefreshUnavailable = LoggerMessage.Define(
        LogLevel.Warning,
        new EventId(2, nameof(LogRefreshUnavailable)),
        "The WorkOS refresh endpoint is temporarily unavailable.");
    private readonly IDataProtector _protector;
    private readonly ILogger<WorkOSSessionCookie> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly WorkOSSessionClient _client;
    private readonly WorkOSSessionOptions _options;

    public WorkOSSessionCookie(
        IDataProtectionProvider protectionProvider,
        ILogger<WorkOSSessionCookie> logger,
        TimeProvider timeProvider,
        WorkOSSessionClient client,
        WorkOSAuthenticationOptions options)
    {
        _protector = protectionProvider.CreateProtector(
            "Kajay.Workflow.Host.WorkOS.Session.v1");
        _logger = logger;
        _timeProvider = timeProvider;
        _client = client;
        _options = options.Session;
    }

    internal async ValueTask<string?> ResolveAccessTokenAsync(
        HttpContext context,
        CancellationToken cancellationToken)
    {
        WorkOSSession? session = Read(context);
        if (session is null)
        {
            return null;
        }
        if (!NeedsRefresh(session.AccessToken))
        {
            return session.AccessToken;
        }
        return await RefreshAsync(context, session, cancellationToken).ConfigureAwait(false);
    }

    internal WorkOSSession? Read(HttpContext context)
    {
        string? protectedValue = context.Request.Cookies[CookieName];
        if (string.IsNullOrWhiteSpace(protectedValue))
        {
            return null;
        }
        try
        {
            return JsonSerializer.Deserialize<WorkOSSession>(_protector.Unprotect(protectedValue));
        }
        catch (Exception exception) when (
            exception is CryptographicException or FormatException or JsonException)
        {
            Delete(context);
            return null;
        }
    }

    internal void Write(HttpContext context, string accessToken, string refreshToken)
    {
        var session = new WorkOSSession(accessToken, refreshToken);
        string protectedValue = _protector.Protect(JsonSerializer.Serialize(session));
        context.Response.Cookies.Append(
            CookieName,
            protectedValue,
            CreateOptions(_timeProvider.GetUtcNow().Add(Lifetime)));
    }

    internal void Delete(HttpContext context) =>
        context.Response.Cookies.Delete(CookieName, CreateOptions(null));

    private bool NeedsRefresh(string accessToken)
    {
        try
        {
            DateTime expiresAt = new JsonWebTokenHandler().ReadJsonWebToken(accessToken).ValidTo;
            return expiresAt <= _timeProvider.GetUtcNow().UtcDateTime.Add(RefreshWindow);
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private async ValueTask<string> RefreshAsync(
        HttpContext context,
        WorkOSSession session,
        CancellationToken cancellationToken)
    {
        try
        {
            AuthenticateResponse response = await _client.Server.UserManagement
                .AuthenticateWithRefreshTokenAsync(
                    new AuthenticateWithRefreshTokenOptions { RefreshToken = session.RefreshToken },
                    cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            EnsureTokens(response.AccessToken, response.RefreshToken);
            Write(context, response.AccessToken, response.RefreshToken);
            return response.AccessToken;
        }
        catch (ApiException exception)
        {
            LogRefreshRejected(_logger, exception);
            Delete(context);
            return session.AccessToken;
        }
        catch (Exception exception) when (
            exception is HttpRequestException or TaskCanceledException)
        {
            LogRefreshUnavailable(_logger, exception);
            return session.AccessToken;
        }
    }

    private CookieOptions CreateOptions(DateTimeOffset? expiresAt) => new()
    {
        Expires = expiresAt,
        HttpOnly = true,
        IsEssential = true,
        Path = "/",
        SameSite = SameSiteMode.Lax,
        Secure = Uri.TryCreate(_options.CallbackUrl, UriKind.Absolute, out Uri? callback)
            && callback.Scheme == Uri.UriSchemeHttps,
    };

    private static void EnsureTokens(string accessToken, string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(accessToken) || string.IsNullOrWhiteSpace(refreshToken))
        {
            throw new InvalidOperationException("WorkOS returned an incomplete browser session.");
        }
    }
}
