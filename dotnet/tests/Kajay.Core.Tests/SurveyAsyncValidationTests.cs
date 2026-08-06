namespace Kajay.Core.Tests;

public sealed class SurveyAsyncValidationTests
{
    [Fact]
    public async Task AdvanceAwaitsHostAndServerValidationAndBlocksOnErrors()
    {
        List<string> calls = [];
        Survey survey = CreateSurvey(new SurveyOptions
        {
            QuestionValidator = context =>
            {
                calls.Add($"sync:{context.Name}");
                return [];
            },
            AsyncQuestionValidator = (context, _) =>
            {
                calls.Add($"async:{context.Name}");
                return ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>([]);
            },
            ServerValidator = (context, _) =>
            {
                calls.Add($"server:{context.Data.Count}:{context.QuestionNames[0]}");
                return ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>(
                    [new SurveyValidationError("answer", "server", "Rejected")]);
            },
        });
        survey.SetValue("answer", KajayValue.From("valid"));

        SurveyAdvanceOutcome outcome = await survey.AdvanceAsync();

        Assert.Equal(SurveyAdvanceOutcome.Blocked, outcome);
        Assert.Equal("one", survey.CurrentPageName);
        Assert.Equal(["sync:answer", "async:answer", "server:1:answer"], calls);
        Assert.False(survey.Validation.IsValidating);
    }

    [Fact]
    public async Task AChangedSnapshotCannotBeAdvancedByAStaleReply()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Survey survey = CreateSurvey(new SurveyOptions
        {
            AsyncQuestionValidator = async (_, cancellationToken) =>
            {
                await release.Task.WaitAsync(cancellationToken);
                return [new SurveyValidationError("answer", "stale")];
            },
        });
        survey.SetValue("answer", KajayValue.From("before"));

        Task<SurveyAdvanceOutcome> pending = survey.AdvanceAsync();
        Assert.True(survey.Validation.IsValidating);
        survey.SetValue("answer", KajayValue.From("after"));
        release.SetResult();

        Assert.Equal(SurveyAdvanceOutcome.NoChange, await pending);
        Assert.Equal("one", survey.CurrentPageName);
        Assert.Empty(survey.Validation.Errors);
        Assert.False(survey.Validation.IsValidating);
    }

    [Fact]
    public async Task CancellationStopsValidationWithoutMoving()
    {
        Survey survey = CreateSurvey(new SurveyOptions
        {
            AsyncQuestionValidator = async (_, cancellationToken) =>
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
                return [];
            },
        });
        survey.SetValue("answer", KajayValue.From("valid"));
        using var cancellation = new CancellationTokenSource();

        Task<SurveyAdvanceOutcome> pending = survey.AdvanceAsync(cancellation.Token);
        Assert.True(survey.Validation.IsValidating);
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.False(survey.Validation.IsValidating);
        Assert.Equal("one", survey.CurrentPageName);
    }

    [Fact]
    public async Task SynchronousFailuresAvoidUnnecessaryHostRoundTrips()
    {
        int asyncCalls = 0;
        Survey survey = CreateSurvey(new SurveyOptions
        {
            AsyncQuestionValidator = (_, _) =>
            {
                asyncCalls += 1;
                return ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>([]);
            },
        });

        Assert.Equal(SurveyAdvanceOutcome.Blocked, await survey.AdvanceAsync());
        Assert.Equal(0, asyncCalls);
    }

    [Fact]
    public async Task OnCompleteDefersAllReachableQuestionsUntilTheLastPage()
    {
        int asyncCalls = 0;
        Survey survey = SurveyDefinition.Parse(
            """
            {
              "checkErrorsMode":"onComplete",
              "pages":[
                {"name":"one","elements":[{"type":"text","name":"first","isRequired":true}]},
                {"name":"two","elements":[{"type":"text","name":"second"}]}
              ]
            }
            """)
            .Definition
            .CreateSurvey(new SurveyOptions
            {
                AsyncQuestionValidator = (_, _) =>
                {
                    asyncCalls += 1;
                    return ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>([]);
                },
            });

        Assert.Equal(SurveyValidationMode.OnComplete, survey.Validation.Mode);
        Assert.Equal(SurveyAdvanceOutcome.Advanced, await survey.AdvanceAsync());
        Assert.Equal(0, asyncCalls);
        Assert.Equal(SurveyAdvanceOutcome.Blocked, await survey.AdvanceAsync());
        Assert.Equal(0, asyncCalls);
    }

    [Fact]
    public async Task DisabledValidationNeitherRunsNorBlocks()
    {
        int hostCalls = 0;
        Survey survey = SurveyDefinition.Parse(
            """{"validationEnabled":false,"pages":[{"name":"one","elements":[{"type":"text","name":"answer","isRequired":true}]},{"name":"two"}]}""")
            .Definition
            .CreateSurvey(new SurveyOptions
            {
                QuestionValidator = _ =>
                {
                    hostCalls += 1;
                    return [new SurveyValidationError("answer", "host")];
                },
            });

        Assert.False(survey.Validation.IsEnabled);
        Assert.Equal(SurveyAdvanceOutcome.Advanced, await survey.AdvanceAsync());
        Assert.Equal(0, hostCalls);
    }

    private static Survey CreateSurvey(SurveyOptions options)
    {
        return SurveyDefinition.Parse(
            """
            {
              "pages":[
                {"name":"one","elements":[{"type":"text","name":"answer","isRequired":true}]},
                {"name":"two"}
              ]
            }
            """)
            .Definition
            .CreateSurvey(options);
    }
}
