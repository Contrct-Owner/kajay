using Kajay.Cli.Authentication;

namespace Kajay.Cli.Promotion;

internal sealed record PromotionRequest(
    Uri SourceHost,
    MachineIdentity SourceIdentity,
    Uri TargetHost,
    MachineIdentity TargetIdentity,
    string ReleaseDigest,
    string EnvironmentName,
    bool Activate,
    long? ExpectedVersion);
