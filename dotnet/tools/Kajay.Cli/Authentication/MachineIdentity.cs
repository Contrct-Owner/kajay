namespace Kajay.Cli.Authentication;

internal sealed record MachineIdentity(
    Uri TokenEndpoint,
    string ClientId,
    string ClientSecret,
    string Scope);
