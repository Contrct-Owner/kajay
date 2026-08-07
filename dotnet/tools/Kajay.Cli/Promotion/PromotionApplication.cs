using Kajay.Cli.Authentication;

namespace Kajay.Cli.Promotion;

internal sealed class PromotionApplication(HttpClient httpClient)
{
    internal async Task<PromotionResult> PromoteAsync(
        PromotionRequest request,
        CancellationToken cancellationToken)
    {
        Validate(request);
        var tokens = new WorkOSTokenClient(httpClient);
        string sourceToken = await tokens.AcquireAsync(request.SourceIdentity, cancellationToken)
            .ConfigureAwait(false);
        var source = new WorkflowHostClient(httpClient, request.SourceHost, sourceToken);
        byte[] bundle = await source.ExportAsync(request.ReleaseDigest, cancellationToken)
            .ConfigureAwait(false);

        string targetToken = await tokens.AcquireAsync(request.TargetIdentity, cancellationToken)
            .ConfigureAwait(false);
        var target = new WorkflowHostClient(httpClient, request.TargetHost, targetToken);
        ReleasePreflightResponse preflight = await target.PreflightAsync(
            request.EnvironmentName,
            bundle,
            cancellationToken).ConfigureAwait(false);
        ValidatePreflight(request, preflight);
        ReleaseInstallResponse install = await target.InstallAsync(bundle, cancellationToken)
            .ConfigureAwait(false);
        ValidateInstall(preflight, install);
        ActivationResponse? activation = request.Activate
            ? await target.ActivateAsync(
                request.EnvironmentName,
                preflight.ManagedDefinitionName,
                preflight.Digest,
                request.ExpectedVersion!.Value,
                cancellationToken).ConfigureAwait(false)
            : null;
        ValidateActivation(request, preflight, activation);
        return new PromotionResult(
            preflight.Digest,
            preflight.ManagedDefinitionName,
            preflight.VersionLabel,
            request.EnvironmentName,
            install.Installed,
            activation?.Version,
            activation?.ApprovedBy);
    }

    private static void Validate(PromotionRequest request)
    {
        ValidateHost(request.SourceHost, nameof(request.SourceHost));
        ValidateHost(request.TargetHost, nameof(request.TargetHost));
        ValidateIdentity(request.SourceIdentity, nameof(request.SourceIdentity));
        ValidateIdentity(request.TargetIdentity, nameof(request.TargetIdentity));
        ValidateDigest(request.ReleaseDigest);
        ValidateName(request.EnvironmentName, nameof(request.EnvironmentName));
        if (request.Activate != request.ExpectedVersion.HasValue)
        {
            throw new PromotionException(
                "invalid-activation-options",
                "--expected-version is required exactly when --activate is present.");
        }
        if (request.ExpectedVersion is < 0)
        {
            throw new PromotionException(
                "invalid-expected-version",
                "--expected-version cannot be negative.");
        }
    }

    private static void ValidatePreflight(
        PromotionRequest request,
        ReleasePreflightResponse preflight)
    {
        if (!string.Equals(preflight.Digest, request.ReleaseDigest, StringComparison.Ordinal))
        {
            throw new PromotionException(
                "release-digest-mismatch",
                $"The exported bundle computed to '{preflight.Digest}' for requested release "
                    + $"'{request.ReleaseDigest}'.");
        }
        if (!preflight.Compatible)
        {
            string missing = string.Join(", ", preflight.MissingBindings);
            throw new PromotionException(
                "target-preflight-incompatible",
                $"The target is missing required environment bindings: {missing}.");
        }
    }

    private static void ValidateInstall(
        ReleasePreflightResponse preflight,
        ReleaseInstallResponse install)
    {
        if (!string.Equals(install.Digest, preflight.Digest, StringComparison.Ordinal)
            || !string.Equals(
                install.ManagedDefinitionName,
                preflight.ManagedDefinitionName,
                StringComparison.Ordinal)
            || !string.Equals(install.VersionLabel, preflight.VersionLabel, StringComparison.Ordinal))
        {
            throw new PromotionException(
                "target-install-mismatch",
                "The target installation result did not match its preflight result.");
        }
    }

    private static void ValidateActivation(
        PromotionRequest request,
        ReleasePreflightResponse preflight,
        ActivationResponse? activation)
    {
        if (activation is null)
        {
            return;
        }
        if (!string.Equals(activation.EnvironmentName, request.EnvironmentName, StringComparison.Ordinal)
            || !string.Equals(
                activation.ManagedDefinitionName,
                preflight.ManagedDefinitionName,
                StringComparison.Ordinal)
            || !string.Equals(activation.ReleaseDigest, preflight.Digest, StringComparison.Ordinal)
            || activation.Version != request.ExpectedVersion!.Value + 1)
        {
            throw new PromotionException(
                "target-activation-mismatch",
                "The target Activation result did not match the requested release and version.");
        }
    }

    private static void ValidateHost(Uri value, string name)
    {
        if (!value.IsAbsoluteUri
            || (value.Scheme != Uri.UriSchemeHttp && value.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(value.UserInfo)
            || !string.IsNullOrEmpty(value.Query)
            || !string.IsNullOrEmpty(value.Fragment))
        {
            throw new PromotionException(
                "invalid-host",
                $"{name} must be an absolute HTTP(S) origin without credentials, query, or fragment.");
        }
    }

    private static void ValidateDigest(string value)
    {
        if (value.Length != 71
            || !value.StartsWith("sha256:", StringComparison.Ordinal)
            || value[7..].Any(character => character is not (>= '0' and <= '9')
                and not (>= 'a' and <= 'f')))
        {
            throw new PromotionException(
                "invalid-release-digest",
                "--release must be a lowercase sha256 digest.");
        }
    }

    private static void ValidateName(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw new PromotionException("invalid-name", $"{name} must contain 1 to 128 characters.");
        }
    }

    private static void ValidateIdentity(MachineIdentity identity, string name)
    {
        ValidateHost(identity.TokenEndpoint, $"{name}.TokenEndpoint");
        if (string.IsNullOrWhiteSpace(identity.ClientId)
            || string.IsNullOrWhiteSpace(identity.ClientSecret)
            || string.IsNullOrWhiteSpace(identity.Scope))
        {
            throw new PromotionException(
                "invalid-machine-identity",
                $"{name} requires a client ID, client secret, and scope.");
        }
    }
}
