namespace Kajay.Workflow.Host.Api;

internal sealed class WorkflowProblemException(int statusCode, string code, string message)
    : Exception(message)
{
    internal int StatusCode { get; } = statusCode;

    internal string Code { get; } = code;
}
