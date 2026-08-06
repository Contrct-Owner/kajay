namespace Kajay.Demo.Api;

public sealed record DemoAnswerValidationResult(
    string Runtime,
    IReadOnlyList<DemoSubmissionError> Errors);
