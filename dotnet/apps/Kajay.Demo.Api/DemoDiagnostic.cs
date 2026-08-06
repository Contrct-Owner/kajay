namespace Kajay.Demo.Api;

public sealed record DemoDiagnostic(
    string Code,
    string Path,
    string Severity,
    string Message);
