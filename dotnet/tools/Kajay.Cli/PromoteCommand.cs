using System.CommandLine;
using System.Text.Json;
using Kajay.Cli.Authentication;
using Kajay.Cli.Promotion;

namespace Kajay.Cli;

internal static class PromoteCommand
{
    private const string SourceSecretDefault = "KAJAY_SOURCE_CLIENT_SECRET";
    private const string TargetSecretDefault = "KAJAY_TARGET_CLIENT_SECRET";
    private const string ManageScope = "kajay:definition:manage";
    private const string PromoteScope = "kajay:definition:promote";
    private const string ApproveScope = "kajay:definition:approve";
    private static readonly JsonSerializerOptions OutputJson = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    internal static Command Create(Func<string, string?> readEnvironment)
    {
        var sourceHost = Required("--source-host", "Workflow host that owns the release.");
        var sourceToken = Required("--source-token-endpoint", "Source WorkOS OAuth token endpoint.");
        var sourceClient = Required("--source-client-id", "Source WorkOS M2M client ID.");
        var sourceSecret = Optional(
            "--source-client-secret-env",
            $"Environment variable containing the source secret; default {SourceSecretDefault}.");
        var targetHost = Required("--target-host", "Workflow host receiving the release.");
        var targetToken = Required("--target-token-endpoint", "Target WorkOS OAuth token endpoint.");
        var targetClient = Required("--target-client-id", "Target WorkOS M2M client ID.");
        var targetSecret = Optional(
            "--target-client-secret-env",
            $"Environment variable containing the target secret; default {TargetSecretDefault}.");
        var release = Required("--release", "Immutable sha256 release digest to promote.");
        var environment = Required("--environment", "Target environment binding and activation name.");
        var activate = new Option<bool>("--activate")
        {
            Description = "Activate the installed release after promotion.",
        };
        var expectedVersion = new Option<long?>("--expected-version")
        {
            Description = "Current target activation version; required with --activate.",
        };
        var command = new Command("promote", "Promote one immutable release between workflow hosts.");
        AddOptions(command, sourceHost, sourceToken, sourceClient, sourceSecret);
        AddOptions(command, targetHost, targetToken, targetClient, targetSecret);
        AddOptions(command, release, environment, activate, expectedVersion);
        command.SetAction(async (parseResult, cancellationToken) =>
        {
            try
            {
                PromotionRequest request = CreateRequest(
                    parseResult,
                    readEnvironment,
                    sourceHost,
                    sourceToken,
                    sourceClient,
                    sourceSecret,
                    targetHost,
                    targetToken,
                    targetClient,
                    targetSecret,
                    release,
                    environment,
                    activate,
                    expectedVersion);
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                var application = new PromotionApplication(httpClient);
                PromotionResult result = await application.PromoteAsync(request, cancellationToken)
                    .ConfigureAwait(false);
                Console.Out.WriteLine(JsonSerializer.Serialize(result, OutputJson));
                return 0;
            }
            catch (PromotionException exception)
            {
                WriteError(exception.Code, exception.Message);
                return 1;
            }
            catch (HttpRequestException exception)
            {
                WriteError("network-failure", exception.Message);
                return 1;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                WriteError("request-timeout", "Promotion did not complete within two minutes.");
                return 1;
            }
        });
        return command;
    }

    private static PromotionRequest CreateRequest(
        ParseResult result,
        Func<string, string?> readEnvironment,
        Option<string> sourceHost,
        Option<string> sourceToken,
        Option<string> sourceClient,
        Option<string> sourceSecret,
        Option<string> targetHost,
        Option<string> targetToken,
        Option<string> targetClient,
        Option<string> targetSecret,
        Option<string> release,
        Option<string> environment,
        Option<bool> activate,
        Option<long?> expectedVersion)
    {
        bool shouldActivate = result.GetValue(activate);
        string environmentName = result.GetRequiredValue(environment);
        string targetScope = ReadTargetScope(environmentName, shouldActivate);
        return new PromotionRequest(
            ReadUri(result, sourceHost),
            ReadIdentity(result, readEnvironment, sourceToken, sourceClient, sourceSecret,
                SourceSecretDefault, ManageScope),
            ReadUri(result, targetHost),
            ReadIdentity(result, readEnvironment, targetToken, targetClient, targetSecret,
                TargetSecretDefault, targetScope),
            result.GetRequiredValue(release),
            environmentName,
            shouldActivate,
            result.GetValue(expectedVersion));
    }

    private static MachineIdentity ReadIdentity(
        ParseResult result,
        Func<string, string?> readEnvironment,
        Option<string> tokenEndpoint,
        Option<string> clientId,
        Option<string> secretEnvironment,
        string defaultSecretEnvironment,
        string scope)
    {
        string secretName = result.GetValue(secretEnvironment) ?? defaultSecretEnvironment;
        string secret = readEnvironment(secretName)
            ?? throw new PromotionException(
                "client-secret-missing",
                $"Environment variable '{secretName}' is not set.");
        return new MachineIdentity(
            ReadUri(result, tokenEndpoint),
            result.GetRequiredValue(clientId),
            secret,
            scope);
    }

    private static Uri ReadUri(ParseResult result, Option<string> option)
    {
        string value = result.GetRequiredValue(option);
        return Uri.TryCreate(value, UriKind.Absolute, out Uri? uri)
            ? uri
            : throw new PromotionException("invalid-uri", $"{option.Name} must be an absolute URI.");
    }

    private static string ReadTargetScope(string environmentName, bool activate)
    {
        string scope = $"{ManageScope} {PromoteScope}";
        return activate && string.Equals(environmentName, "production", StringComparison.OrdinalIgnoreCase)
            ? $"{scope} {ApproveScope}"
            : scope;
    }

    private static Option<string> Required(string name, string description)
    {
        return new Option<string>(name) { Description = description, Required = true };
    }

    private static Option<string> Optional(string name, string description)
    {
        return new Option<string>(name) { Description = description };
    }

    private static void AddOptions(Command command, params Option[] options)
    {
        foreach (Option option in options)
        {
            command.Options.Add(option);
        }
    }

    private static void WriteError(string code, string message)
    {
        Console.Error.WriteLine(JsonSerializer.Serialize(new { error = new { code, message } }, OutputJson));
    }
}
