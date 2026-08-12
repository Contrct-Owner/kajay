namespace Kajay.Core.Tests;

public sealed class SurveyLazyChoiceTests
{
    [Fact]
    public async Task InitialAndAdditionalPagesUseHostDeclaredPaging()
    {
        var requests = new List<SurveyChoicePageRequest>();
        SurveyDefinition definition = SurveyDefinition.Parse(Definition()).Definition;
        Survey survey = await definition.CreateSurveyAsync(new SurveyOptions
        {
            ChoicePageLoader = (request, cancellationToken) =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                requests.Add(request);
                int start = request.Skip;
                return ValueTask.FromResult(new SurveyChoicePage(
                    [Item(start), Item(start + 1)],
                    request.Skip == 0));
            },
        });
        SurveyChoiceQuestion question = GetQuestion(survey);

        Assert.True(question.IsPaged);
        Assert.False(question.IsLoadingChoices);
        Assert.True(question.HasMoreChoices);
        Assert.Equal(["City 0", "City 1"], question.ChoiceItems.Select(item => item.Text));

        await question.LoadMoreChoicesAsync();

        Assert.Equal([0, 2], requests.Select(request => request.Skip));
        Assert.All(requests, request => Assert.Equal(2, request.Take));
        Assert.Equal(4, question.Choices.Count);
        Assert.False(question.HasMoreChoices);
        await question.LoadMoreChoicesAsync();
        Assert.Equal(2, requests.Count);
    }

    [Fact]
    public async Task ANewFilterMakesAnOlderReplyObsolete()
    {
        var replies = new Dictionary<string, TaskCompletionSource<SurveyChoicePage>>(
            StringComparer.Ordinal);
        Survey survey = CreateSurvey((request, _) =>
        {
            var reply = new TaskCompletionSource<SurveyChoicePage>(
                TaskCreationOptions.RunContinuationsAsynchronously);
            replies.Add(request.Filter, reply);
            return new ValueTask<SurveyChoicePage>(reply.Task);
        });
        SurveyChoiceQuestion question = GetQuestion(survey);

        Task older = question.SetChoiceFilterAsync(" old ");
        Task current = question.SetChoiceFilterAsync("new");
        replies["old"].SetResult(new SurveyChoicePage([Item(1)], false));
        await older;

        Assert.True(question.IsLoadingChoices);
        Assert.Empty(question.Choices);
        replies["new"].SetResult(new SurveyChoicePage([Item(2)], false));
        await current;

        Assert.False(question.IsLoadingChoices);
        Assert.Equal("new", question.ChoiceFilter);
        Assert.Equal([KajayValue.From(2)], question.Choices);
    }

    /// <summary>
    /// A completed load has finished loading, every time and not merely usually.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The pager used to signal its completion source before clearing the flag, so awaiting
    /// a load released the caller into a state that had not settled yet. Whether anybody saw
    /// it came down to which of two thread-pool items ran first: green on a quiet machine,
    /// and an occasional red on a loaded one — which is how it reached main and then failed
    /// a release build rather than the pull request that introduced it.
    /// </para>
    /// <para>
    /// **Repeated rather than deterministic, and that is a real limitation.** The window was
    /// between two statements with nothing to synchronise on, so there is no hook to make
    /// the bad interleaving happen on demand — the honest options were many cheap attempts
    /// or nothing at all. Each iteration is in-memory and takes microseconds. Against the
    /// old ordering this fails within a few hundred; against the new one it cannot fail,
    /// because the state is settled before the caller is released at all.
    /// </para>
    /// </remarks>
    [Fact]
    public async Task AnAwaitedLoadHasAlwaysFinishedLoading()
    {
        for (int attempt = 0; attempt < 500; attempt += 1)
        {
            Survey survey = CreateSurvey((request, _) => new ValueTask<SurveyChoicePage>(
                Task.Run(() => new SurveyChoicePage([Item(request.Skip)], false))));
            SurveyChoiceQuestion question = GetQuestion(survey);

            await question.SetChoiceFilterAsync($"filter {attempt}");

            // The claim a host relies on: once the returned task completes, the question is
            // done loading. Reading the flag straight after the await is the whole point —
            // any wait here would hide exactly the fault being guarded against.
            Assert.False(question.IsLoadingChoices);
        }
    }

    [Fact]
    public async Task CancellationClearsLoadingAndThePageCanBeRetried()
    {
        int calls = 0;
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Survey survey = CreateSurvey(async (_, cancellationToken) =>
        {
            calls += 1;
            await release.Task.WaitAsync(cancellationToken);
            return new SurveyChoicePage([Item(1)], false);
        });
        SurveyChoiceQuestion question = GetQuestion(survey);
        using var cancellation = new CancellationTokenSource();

        Task pending = survey.SettleAsync(cancellation.Token);
        Assert.True(question.IsLoadingChoices);
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.False(question.IsLoadingChoices);
        release.SetResult();
        await survey.SettleAsync();
        Assert.Equal(2, calls);
        Assert.Equal([KajayValue.From(1)], question.Choices);
    }

    private static Survey CreateSurvey(SurveyChoicePageLoader loader)
    {
        return SurveyDefinition.Parse(Definition()).Definition.CreateSurvey(new SurveyOptions
        {
            ChoicePageLoader = loader,
        });
    }

    private static SurveyChoiceQuestion GetQuestion(Survey survey)
    {
        return Assert.IsType<SurveyChoiceQuestion>(survey.GetQuestion("city"));
    }

    private static SurveyChoiceItem Item(int value)
    {
        return new SurveyChoiceItem(KajayValue.From(value), $"City {value}");
    }

    private static string Definition()
    {
        return """
            {
              "pages":[{"name":"page","elements":[{
                "type":"dropdown",
                "name":"city",
                "choices":["authored"],
                "choicesLazyLoadEnabled":true,
                "choicesLazyLoadPageSize":2
              }]}]
            }
            """;
    }
}
