using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSJwksConfigurationRetriever
    : IConfigurationRetriever<OpenIdConnectConfiguration>
{
    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(
        string address,
        IDocumentRetriever retriever,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(address);
        ArgumentNullException.ThrowIfNull(retriever);
        string document = await retriever.GetDocumentAsync(address, cancellationToken)
            .ConfigureAwait(false);
        var keySet = new JsonWebKeySet(document);
        var configuration = new OpenIdConnectConfiguration { JsonWebKeySet = keySet };
        foreach (SecurityKey key in keySet.GetSigningKeys())
        {
            configuration.SigningKeys.Add(key);
        }
        return configuration;
    }
}
