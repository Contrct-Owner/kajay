using Microsoft.IdentityModel.JsonWebTokens;
using WorkOS;

namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSLoginApplication
{
    private static readonly Action<ILogger, Exception?> LogCodeExchangeRejected =
        LoggerMessage.Define(
            LogLevel.Information,
            new EventId(1, nameof(LogCodeExchangeRejected)),
            "WorkOS rejected an authorization-code exchange.");
    private readonly ILogger<WorkOSLoginApplication> _logger;
    private readonly WorkOSLoginStateCookie _loginStateCookie;
    private readonly WorkOSSessionClient _client;
    private readonly WorkOSSessionCookie _sessionCookie;
    private readonly WorkOSSessionOptions _options;

    public WorkOSLoginApplication(
        ILogger<WorkOSLoginApplication> logger,
        WorkOSLoginStateCookie loginStateCookie,
        WorkOSSessionClient client,
        WorkOSSessionCookie sessionCookie,
        WorkOSAuthenticationOptions options)
    {
        _logger = logger;
        _loginStateCookie = loginStateCookie;
        _client = client;
        _sessionCookie = sessionCookie;
        _options = options.Session;
    }

    internal IResult Start(HttpContext context, string? loginHint)
    {
        PkceAuthorizationUrlResult authorization = _client.Browser
            .GetAuthorizationUrlWithPkce(new AuthKitAuthorizationUrlOptions
            {
                LoginHint = loginHint,
                Provider = "authkit",
                RedirectUri = _options.CallbackUrl,
            });
        _loginStateCookie.Write(context, authorization.State, authorization.CodeVerifier);
        return Results.Redirect(authorization.Url);
    }

    internal async Task<IResult> CompleteAsync(
        HttpContext context,
        string? code,
        string? state,
        string? error,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(error))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "WorkOS authentication was not completed.");
        }
        if (string.IsNullOrWhiteSpace(code)
            || string.IsNullOrWhiteSpace(state)
            || !_loginStateCookie.TryConsume(context, state, out WorkOSLoginState? loginState))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "The WorkOS authentication response is invalid or expired.");
        }
        try
        {
            AuthenticateResponse response = await _client.Server.UserManagement
                .AuthenticateWithCodeAsync(
                    new AuthenticateWithCodeOptions
                    {
                        Code = code,
                        CodeVerifier = loginState!.CodeVerifier,
                        IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                        UserAgent = context.Request.Headers.UserAgent.ToString(),
                    },
                    cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(response.OrganizationId)
                || string.IsNullOrWhiteSpace(response.AccessToken)
                || string.IsNullOrWhiteSpace(response.RefreshToken))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "A selected WorkOS organization is required.");
            }
            _sessionCookie.Write(context, response.AccessToken, response.RefreshToken);
            return Results.Redirect(_options.PostLoginRedirectUrl);
        }
        catch (ApiException exception)
        {
            LogCodeExchangeRejected(_logger, exception);
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "WorkOS authentication could not be completed.");
        }
    }

    internal IResult Logout(HttpContext context)
    {
        WorkOSSession? session = _sessionCookie.Read(context);
        _sessionCookie.Delete(context);
        string? sessionId = session is null ? null : ReadSessionId(session.AccessToken);
        return string.IsNullOrWhiteSpace(sessionId)
            ? Results.Redirect(_options.PostLogoutRedirectUrl)
            : Results.Redirect(
                _client.Browser.GetLogoutUrl(sessionId, _options.PostLogoutRedirectUrl));
    }

    private static string? ReadSessionId(string accessToken)
    {
        try
        {
            JsonWebToken token = new JsonWebTokenHandler().ReadJsonWebToken(accessToken);
            return token.Claims.FirstOrDefault(claim => claim.Type == "sid")?.Value;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }
}
