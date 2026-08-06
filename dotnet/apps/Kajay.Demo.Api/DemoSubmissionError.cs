namespace Kajay.Demo.Api;

public sealed record DemoSubmissionError(
    string Name,
    string Kind,
    string Message,
    string Path);
