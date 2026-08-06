using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay.Validation;

namespace Kajay.Demo.Api;

/// <summary>Owns the demo use cases; HTTP is only one adapter over this module.</summary>
public sealed class DemoSurveyApplication
{
    private const string RuntimeName = "dotnet";
    private const string BlockedEmail = "blocked@example.com";

    public DemoDefinitionResult GetDefinition()
    {
        using JsonDocument document = JsonDocument.Parse(DemoSurveyDefinitionSource.Read());
        return ValidateDefinition(document.RootElement);
    }

    public DemoDefinitionResult ValidateDefinition(JsonElement definition)
    {
        try
        {
            SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(definition.GetRawText());
            DemoDiagnostic[] diagnostics = parsed.Diagnostics.Select(ToDiagnostic).ToArray();
            return new DemoDefinitionResult(
                RuntimeName,
                diagnostics.All(diagnostic => diagnostic.Severity != "error"),
                JsonNode.Parse(parsed.Definition.ToCanonicalJson()),
                diagnostics);
        }
        catch (JsonException exception)
        {
            return InvalidDefinition(exception.Message);
        }
    }

    public async Task<DemoSubmissionResult> SubmitAsync(
        DemoSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        DemoDefinitionResult definitionResult = ValidateDefinition(request.Definition);
        if (!definitionResult.Accepted || definitionResult.Definition is null)
        {
            return InvalidSubmission(definitionResult.Diagnostics);
        }

        SurveyDefinition definition = SurveyDefinition.Parse(
            definitionResult.Definition.ToJsonString()).Definition;
        Survey survey = await definition.CreateSurveyAsync(
            new SurveyOptions { ServerValidator = ValidateServer },
            cancellationToken).ConfigureAwait(false);
        ApplyData(survey, request.Data);

        SurveyAdvanceOutcome outcome = SurveyAdvanceOutcome.NoChange;
        for (int attempt = 0; attempt <= survey.PageCount && !survey.IsCompleted; attempt += 1)
        {
            outcome = await survey.AdvanceAsync(cancellationToken).ConfigureAwait(false);
            if (outcome != SurveyAdvanceOutcome.Advanced)
            {
                break;
            }
        }

        return ToSubmission(survey, outcome, definitionResult.Diagnostics);
    }

    public async Task<DemoAnswerValidationResult> ValidateAnswersAsync(
        DemoAnswerValidationRequest request,
        CancellationToken cancellationToken = default)
    {
        Dictionary<string, KajayValue> data = ReadData(request.Data);
        IReadOnlyList<SurveyValidationError> errors = await ValidateServer(
            new SurveyServerValidationContext(data, request.QuestionNames),
            cancellationToken).ConfigureAwait(false);
        return new DemoAnswerValidationResult(
            RuntimeName,
            errors.Select(error =>
                new DemoSubmissionError(error.Name, error.Kind, error.Message, error.Path))
                .ToArray());
    }

    private static void ApplyData(Survey survey, JsonElement data)
    {
        foreach ((string name, KajayValue value) in ReadData(data))
        {
            survey.SetValue(name, value);
        }
    }

    private static Dictionary<string, KajayValue> ReadData(JsonElement data)
    {
        if (data.ValueKind != JsonValueKind.Object)
        {
            throw new JsonException("Submission data must be a JSON object.");
        }
        return data.EnumerateObject().ToDictionary(
            property => property.Name,
            property => KajayJsonValueAdapter.FromJson(property.Value),
            StringComparer.Ordinal);
    }

    private static ValueTask<IReadOnlyList<SurveyValidationError>> ValidateServer(
        SurveyServerValidationContext context,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        bool isBlocked = context.QuestionNames.Contains("email", StringComparer.Ordinal)
            && context.Data.TryGetValue("email", out KajayValue email)
            && email.Kind == KajayValueKind.Text
            && string.Equals(email.GetString(), BlockedEmail, StringComparison.OrdinalIgnoreCase);
        IReadOnlyList<SurveyValidationError> errors = isBlocked
            ? [new SurveyValidationError(
                "email",
                "server",
                "This demonstration address is blocked by the host validator.")]
            : [];
        return ValueTask.FromResult(errors);
    }

    private static DemoSubmissionResult ToSubmission(
        Survey survey,
        SurveyAdvanceOutcome outcome,
        IReadOnlyList<DemoDiagnostic> diagnostics)
    {
        QuizScore score = survey.GetQuizScore();
        Dictionary<string, object?> data = survey.Data.ToDictionary(
            pair => pair.Key,
            pair => KajayJsonValueAdapter.ToJson(pair.Value),
            StringComparer.Ordinal);
        DemoSubmissionError[] errors = survey.Validation.Errors.Select(error =>
            new DemoSubmissionError(error.Name, error.Kind, error.Message, error.Path)).ToArray();
        return new DemoSubmissionResult(
            RuntimeName,
            survey.IsCompleted,
            survey.IsCompleted,
            outcome.ToString().ToLowerInvariant(),
            data,
            new DemoQuizScore(score.Earned, score.Possible, score.QuestionCount, score.Ratio),
            errors,
            diagnostics);
    }

    private static DemoDefinitionResult InvalidDefinition(string message)
    {
        return new DemoDefinitionResult(
            RuntimeName,
            false,
            null,
            [new DemoDiagnostic("invalid-json-definition", "", "error", message)]);
    }

    private static DemoSubmissionResult InvalidSubmission(
        IReadOnlyList<DemoDiagnostic> diagnostics)
    {
        return new DemoSubmissionResult(
            RuntimeName,
            false,
            false,
            "invalid-definition",
            new Dictionary<string, object?>(StringComparer.Ordinal),
            new DemoQuizScore(0, 0, 0, 0),
            [],
            diagnostics);
    }

    private static DemoDiagnostic ToDiagnostic(DefinitionDiagnostic diagnostic)
    {
        string severity = diagnostic.Severity == DiagnosticSeverity.Error ? "error" : "warning";
        return new DemoDiagnostic(
            diagnostic.Code,
            diagnostic.Path,
            severity,
            $"Definition diagnostic: {diagnostic.Code}.");
    }
}
