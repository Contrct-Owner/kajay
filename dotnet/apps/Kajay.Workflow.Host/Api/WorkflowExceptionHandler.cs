using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Kajay.Workflow.Host.Api;

internal sealed class WorkflowExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<WorkflowExceptionHandler> logger) : IExceptionHandler
{
    private static readonly Action<ILogger, string, Exception?> RequestRejected =
        LoggerMessage.Define<string>(
            LogLevel.Information,
            new EventId(1, nameof(RequestRejected)),
            "Workflow request rejected with {Code}");

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not WorkflowProblemException problem)
        {
            return false;
        }

        RequestRejected(logger, problem.Code, exception);
        httpContext.Response.StatusCode = problem.StatusCode;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = problem.StatusCode,
                Title = problem.Code,
                Detail = problem.Message,
                Type = $"urn:kajay:workflow:problem:{problem.Code}",
            },
        }).ConfigureAwait(false);
    }
}
