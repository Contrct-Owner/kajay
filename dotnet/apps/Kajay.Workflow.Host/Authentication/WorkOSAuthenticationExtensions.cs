using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using WorkOS;

namespace Kajay.Workflow.Host.Authentication;

internal static class WorkOSAuthenticationExtensions
{
    internal static IServiceCollection AddWorkOSAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        WorkOSAuthenticationOptions settings = ReadSettings(configuration);
        services.AddSingleton(settings);
        var client = new PublicWorkOSClient(new PublicWorkOSOptions
        {
            ClientId = settings.ClientId,
            ApiBaseURL = settings.ApiBaseUrl,
        });
        services.AddSingleton(client);
        _ = services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options => ConfigureJwtBearer(options, settings, client));
        AddBrowserSession(services, settings);
        AddPolicies(services);
        return services;
    }

    private static WorkOSAuthenticationOptions ReadSettings(IConfiguration configuration)
    {
        WorkOSAuthenticationOptions settings = configuration
            .GetRequiredSection(WorkOSAuthenticationOptions.SectionName)
            .Get<WorkOSAuthenticationOptions>()
            ?? throw new InvalidOperationException("WorkOS authentication configuration is required.");
        if (string.IsNullOrWhiteSpace(settings.ClientId))
        {
            throw new InvalidOperationException("WorkOS:ClientId is required.");
        }
        if (settings.Audience?.Length > 512)
        {
            throw new InvalidOperationException("WorkOS:Audience cannot exceed 512 characters.");
        }
        ValidateHttpsUri(settings.Issuer, "WorkOS:Issuer", settings.RequireHttpsMetadata);
        ValidateHttpsUri(settings.ApiBaseUrl, "WorkOS:ApiBaseUrl", settings.RequireHttpsMetadata);
        ValidateSessionSettings(settings);
        return settings;
    }

    private static void ConfigureJwtBearer(
        JwtBearerOptions options,
        WorkOSAuthenticationOptions settings,
        PublicWorkOSClient client)
    {
        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = settings.RequireHttpsMetadata;
        options.SaveToken = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = WorkOSClaimValues.Subject,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            RoleClaimType = "role",
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            ValidAudience = string.IsNullOrWhiteSpace(settings.Audience)
                ? settings.ClientId
                : settings.Audience,
            ValidIssuer = settings.Issuer,
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
        };
        options.ConfigurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
            client.GetJwksUrl(),
            new WorkOSJwksConfigurationRetriever(),
            new HttpDocumentRetriever { RequireHttps = settings.RequireHttpsMetadata });
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ResolveBrowserSessionTokenAsync,
            OnTokenValidated = ValidatePrincipalAsync,
        };
    }

    private static async Task ResolveBrowserSessionTokenAsync(MessageReceivedContext context)
    {
        string authorization = context.Request.Headers.Authorization.ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }
        WorkOSSessionCookie? sessionCookie = context.HttpContext.RequestServices
            .GetService<WorkOSSessionCookie>();
        if (sessionCookie is not null)
        {
            context.Token = await sessionCookie.ResolveAccessTokenAsync(
                context.HttpContext,
                context.HttpContext.RequestAborted).ConfigureAwait(false);
        }
    }

    private static Task ValidatePrincipalAsync(TokenValidatedContext context)
    {
        if (!HasRequiredClaim(context, WorkOSClaimValues.Subject)
            || !HasRequiredClaim(context, WorkOSClaimValues.OrganizationId))
        {
            context.Fail("The WorkOS token must select an organization and identify its subject.");
        }
        return Task.CompletedTask;
    }

    private static bool HasRequiredClaim(TokenValidatedContext context, string claimType)
    {
        string? value = context.Principal?.FindFirst(claimType)?.Value;
        return !string.IsNullOrWhiteSpace(value) && value.Length <= 128;
    }

    private static void AddPolicies(IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, WorkOSPermissionHandler>();
        AuthorizationBuilder authorization = services.AddAuthorizationBuilder();
        AddPolicy(authorization, KajayPolicies.WorkflowRead, KajayPermissions.WorkflowRead);
        AddPolicy(authorization, KajayPolicies.WorkflowExecute, KajayPermissions.WorkflowExecute);
        AddPolicy(authorization, KajayPolicies.DefinitionManage, KajayPermissions.DefinitionManage);
        AddPolicy(authorization, KajayPolicies.DefinitionPromote, KajayPermissions.DefinitionPromote);
        AddPolicy(authorization, KajayPolicies.DefinitionApprove, KajayPermissions.DefinitionApprove);
        AddPolicy(authorization, KajayPolicies.EnvironmentManage, KajayPermissions.EnvironmentManage);
    }

    private static void AddBrowserSession(
        IServiceCollection services,
        WorkOSAuthenticationOptions settings)
    {
        if (!settings.Session.Enabled)
        {
            return;
        }
        IDataProtectionBuilder protection = services.AddDataProtection()
            .SetApplicationName("Kajay.Workflow.Host");
        if (!string.IsNullOrWhiteSpace(settings.Session.DataProtectionKeysPath))
        {
            _ = protection.PersistKeysToFileSystem(
                new DirectoryInfo(settings.Session.DataProtectionKeysPath));
        }
        services.AddSingleton<WorkOSSessionClient>();
        services.AddSingleton<WorkOSLoginStateCookie>();
        services.AddSingleton<WorkOSSessionCookie>();
        services.AddSingleton<WorkOSLoginApplication>();
    }

    private static void AddPolicy(
        AuthorizationBuilder authorization,
        string policyName,
        string permission)
    {
        _ = authorization.AddPolicy(policyName, policy =>
        {
            policy.RequireAuthenticatedUser();
            policy.AddRequirements(new WorkOSPermissionRequirement(permission));
        });
    }

    private static void ValidateSessionSettings(WorkOSAuthenticationOptions settings)
    {
        WorkOSSessionOptions session = settings.Session;
        if (!session.Enabled)
        {
            return;
        }
        if (string.IsNullOrWhiteSpace(session.ApiKey))
        {
            throw new InvalidOperationException("WorkOS:Session:ApiKey is required when enabled.");
        }
        ValidateHttpsUri(
            session.BrowserBaseUrl,
            "WorkOS:Session:BrowserBaseUrl",
            settings.RequireHttpsMetadata);
        ValidateHttpsUri(
            session.CallbackUrl,
            "WorkOS:Session:CallbackUrl",
            settings.RequireHttpsMetadata);
        ValidateHttpsUri(
            session.PostLoginRedirectUrl,
            "WorkOS:Session:PostLoginRedirectUrl",
            settings.RequireHttpsMetadata);
        ValidateHttpsUri(
            session.PostLogoutRedirectUrl,
            "WorkOS:Session:PostLogoutRedirectUrl",
            settings.RequireHttpsMetadata);
        if (new Uri(session.CallbackUrl).AbsolutePath != "/auth/callback")
        {
            throw new InvalidOperationException(
                "WorkOS:Session:CallbackUrl must use the /auth/callback path.");
        }
    }

    private static void ValidateHttpsUri(string value, string name, bool requireHttps)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            || (requireHttps && uri.Scheme != Uri.UriSchemeHttps))
        {
            string scheme = requireHttps ? "HTTPS" : "HTTP(S)";
            throw new InvalidOperationException($"{name} must be an absolute {scheme} URI.");
        }
    }
}
