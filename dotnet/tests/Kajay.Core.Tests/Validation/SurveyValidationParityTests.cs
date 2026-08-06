namespace Kajay.Core.Tests;

public sealed class SurveyValidationParityTests
{
    [Fact(DisplayName = "parity/Q6-validation")]
    public async Task PublicValidationSurfaceCoversRulesHostsStateAndCancellation()
    {
        List<IReadOnlyList<SurveyValidationError>> snapshots = [];
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "checkErrorsMode":"onValueChanged",
              "pages":[
                {
                  "name":"one",
                  "elements":[
                    {"type":"text","name":"required","isRequired":true},
                    {"type":"text","name":"builtIn","validators":[{"type":"textvalidator","minLength":5}]},
                    {"type":"text","name":"expression","validators":[{"type":"expressionvalidator","expression":"{agreed} = true","text":"Agree first"}]},
                    {"type":"text","name":"custom"},
                    {"type":"text","name":"async"},
                    {"type":"text","name":"server"}
                  ]
                },
                {"name":"two"}
              ]
            }
            """)
            .Definition
            .CreateSurvey(new SurveyOptions
            {
                QuestionValidator = context =>
                    context.Name == "custom" && context.Value == KajayValue.From("reject")
                        ? [new SurveyValidationError(context.Name, "custom", "Rejected locally")]
                        : [],
                AsyncQuestionValidator = (context, _) =>
                    ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>(
                        context.Name == "async" && context.Value == KajayValue.From("reject")
                            ? [new SurveyValidationError(context.Name, "async", "Rejected asynchronously")]
                            : []),
                ServerValidator = (context, _) =>
                    ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>(
                        context.Data.TryGetValue("server", out KajayValue value)
                        && value == KajayValue.From("reject")
                        && context.QuestionNames.Contains("server", StringComparer.Ordinal)
                            ? [new SurveyValidationError("server", "server", "Rejected remotely")]
                            : []),
            });
        survey.Validation.ErrorsChanged += (_, change) => snapshots.Add(change.Errors);

        survey.SetValue("builtIn", KajayValue.From("bad"));
        Assert.Equal("textvalidator", Assert.Single(survey.Validation.GetErrors("builtIn")).Kind);
        survey.SetValue("builtIn", KajayValue.From("valid"));
        Assert.Empty(survey.Validation.GetErrors("builtIn"));

        survey.SetValue("expression", KajayValue.From("answered"));
        survey.SetValue("agreed", KajayValue.From(false));
        survey.SetValue("custom", KajayValue.From("reject"));
        SurveyValidationResult synchronous = survey.Validation.ValidateCurrentPage();
        Assert.Equal(
            ["required", "expressionvalidator", "custom"],
            synchronous.Errors.Select(error => error.Kind));

        survey.SetValue("required", KajayValue.From("answered"));
        survey.SetValue("agreed", KajayValue.From(true));
        survey.SetValue("custom", KajayValue.From("accepted"));
        survey.SetValue("async", KajayValue.From("reject"));
        survey.SetValue("server", KajayValue.From("reject"));
        Assert.Equal(SurveyAdvanceOutcome.Blocked, await survey.AdvanceAsync());
        Assert.Equal(
            ["async", "server"],
            survey.Validation.Errors.Select(error => error.Kind));

        survey.SetValue("async", KajayValue.From("accepted"));
        survey.SetValue("server", KajayValue.From("accepted"));
        Assert.Equal(SurveyAdvanceOutcome.Advanced, await survey.AdvanceAsync());
        Assert.Equal("two", survey.CurrentPageName);
        Assert.Empty(survey.Validation.Errors);
        Assert.NotEmpty(snapshots);

        Survey cancellable = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"text","name":"answer"}]},{"name":"two"}]}""")
            .Definition
            .CreateSurvey(new SurveyOptions
            {
                AsyncQuestionValidator = async (_, cancellationToken) =>
                {
                    await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
                    return [];
                },
            });
        cancellable.SetValue("answer", KajayValue.From("value"));
        using var cancellation = new CancellationTokenSource();
        Task<SurveyAdvanceOutcome> pending = cancellable.AdvanceAsync(cancellation.Token);
        Assert.True(cancellable.Validation.IsValidating);
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.False(cancellable.Validation.IsValidating);
        Assert.Equal("one", cancellable.CurrentPageName);
    }
}
