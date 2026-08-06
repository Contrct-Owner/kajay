using Microsoft.AspNetCore.Http.HttpResults;

namespace Kajay.Demo.Api;

internal static class DemoEndpoints
{
    internal static IEndpointRouteBuilder MapDemoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder demo = endpoints.MapGroup("/api/demo").WithTags("Kajay SDK demo");
        demo.MapGet("/definition", GetDefinition)
            .WithName("GetDemoDefinition");
        demo.MapPost("/definitions/validate", ValidateDefinition)
            .WithName("ValidateDemoDefinition");
        demo.MapPost("/answers/validate", ValidateAnswers)
            .WithName("ValidateDemoAnswers");
        demo.MapPost("/submissions", Submit)
            .WithName("SubmitDemoSurvey");
        return endpoints;
    }

    private static async Task<Ok<DemoAnswerValidationResult>> ValidateAnswers(
        DemoAnswerValidationRequest request,
        DemoSurveyApplication application,
        CancellationToken cancellationToken)
    {
        DemoAnswerValidationResult result = await application.ValidateAnswersAsync(
            request,
            cancellationToken).ConfigureAwait(false);
        return TypedResults.Ok(result);
    }

    private static Ok<DemoDefinitionResult> GetDefinition(DemoSurveyApplication application)
    {
        return TypedResults.Ok(application.GetDefinition());
    }

    private static Ok<DemoDefinitionResult> ValidateDefinition(
        DemoDefinitionRequest request,
        DemoSurveyApplication application)
    {
        return TypedResults.Ok(application.ValidateDefinition(request.Definition));
    }

    private static async Task<Ok<DemoSubmissionResult>> Submit(
        DemoSubmissionRequest request,
        DemoSurveyApplication application,
        CancellationToken cancellationToken)
    {
        DemoSubmissionResult result = await application.SubmitAsync(
            request,
            cancellationToken).ConfigureAwait(false);
        return TypedResults.Ok(result);
    }
}
