namespace Kajay.Workflow.Host.Authentication;

internal sealed record WorkOSLoginState(
    string State,
    string CodeVerifier,
    long ExpiresAtUnixSeconds);
