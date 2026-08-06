namespace Kajay.Demo.Api;

public sealed record DemoSubmissionResult(
    string Runtime,
    bool Accepted,
    bool Completed,
    string Outcome,
    IReadOnlyDictionary<string, object?> Data,
    DemoQuizScore Score,
    IReadOnlyList<DemoSubmissionError> Errors,
    IReadOnlyList<DemoDiagnostic> Diagnostics);
