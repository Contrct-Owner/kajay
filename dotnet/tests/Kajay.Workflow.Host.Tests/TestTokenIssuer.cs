using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Kajay.Workflow.Host.Tests;

internal sealed class TestTokenIssuer : IDisposable
{
    internal const string Audience = "client_test_kajay";
    internal const string Issuer = "https://auth.kajay.test/";
    internal static readonly TestTokenIssuer Instance = new();
    internal static readonly string[] AllPermissions =
    [
        "kajay:workflow:read",
        "kajay:workflow:execute",
        "kajay:workflow:review",
        "kajay:definition:manage",
        "kajay:definition:promote",
        "kajay:definition:approve",
        "kajay:environment:manage",
    ];

    private readonly RSA _rsa = RSA.Create(2048);
    private readonly RsaSecurityKey _key;

    private TestTokenIssuer()
    {
        _key = new RsaSecurityKey(_rsa) { KeyId = "kajay-test-key" };
    }

    internal string Issue(
        string organizationId,
        string subject = "test-actor",
        IReadOnlyCollection<string>? permissions = null,
        string? audience = null)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Audience = audience ?? Audience,
            Claims = new Dictionary<string, object>
            {
                ["org_id"] = organizationId,
                ["permissions"] = permissions?.ToArray() ?? AllPermissions,
                ["sub"] = subject,
            },
            Expires = DateTime.UtcNow.AddMinutes(5),
            IssuedAt = DateTime.UtcNow,
            Issuer = Issuer,
            NotBefore = DateTime.UtcNow.AddMinutes(-1),
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.RsaSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    internal void Configure(JwtBearerOptions options)
    {
        var configuration = new OpenIdConnectConfiguration { Issuer = Issuer };
        configuration.SigningKeys.Add(_key);
        options.ConfigurationManager =
            new StaticConfigurationManager<OpenIdConnectConfiguration>(configuration);
        options.TokenValidationParameters.ValidAudience = Audience;
        options.TokenValidationParameters.ValidIssuer = Issuer;
    }

    public void Dispose()
    {
        _rsa.Dispose();
    }
}
