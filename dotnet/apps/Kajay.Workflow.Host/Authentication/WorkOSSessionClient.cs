using WorkOS;

namespace Kajay.Workflow.Host.Authentication;

internal sealed class WorkOSSessionClient
{
    public WorkOSSessionClient(WorkOSAuthenticationOptions options)
    {
        Browser = new PublicWorkOSClient(new PublicWorkOSOptions
        {
            ApiBaseURL = options.Session.BrowserBaseUrl,
            ClientId = options.ClientId,
        });
        Server = new WorkOSClient(new WorkOSOptions
        {
            ApiBaseURL = options.ApiBaseUrl,
            ApiKey = options.Session.ApiKey,
            ClientId = options.ClientId,
        });
    }

    internal PublicWorkOSClient Browser { get; }

    internal WorkOSClient Server { get; }
}
