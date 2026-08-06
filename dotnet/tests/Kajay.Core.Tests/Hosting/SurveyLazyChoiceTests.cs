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
