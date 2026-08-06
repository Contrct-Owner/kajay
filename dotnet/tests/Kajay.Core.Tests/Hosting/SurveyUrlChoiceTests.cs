namespace Kajay.Core.Tests;

public sealed class SurveyUrlChoiceTests
{
    [Fact]
    public async Task AnswerPlaceholdersAreEncodedAndMappedChoicesAreCached()
    {
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2031, 4, 5, 6, 7, 8, TimeSpan.Zero));
        var requests = new List<SurveyChoiceFetchRequest>();
        Survey survey = CreateSurvey(
            "{@catalog}/regions/{region}",
            Fetch,
            new Dictionary<string, string> { ["catalog"] = "https://choices.test" },
            clock);

        await survey.SetValueAsync("region", KajayValue.From("a b&c"));

        SurveyChoiceQuestion question = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("country"));
        Assert.Equal(
            [KajayValue.From("uk"), KajayValue.From("fr")],
            question.Choices);
        Assert.Equal(
            ["United Kingdom", "France"],
            question.ChoiceItems.Select(item => item.Text));
        Assert.Equal(
            new SurveyChoiceFetchRequest(
                "country",
                "https://choices.test/regions/a%20b%26c",
                clock.GetUtcNow()),
            Assert.Single(requests));

        await survey.SetValueAsync("region", KajayValue.From("other"));
        await survey.SetValueAsync("region", KajayValue.From("a b&c"));
        Assert.Equal(2, requests.Count);

        ValueTask<KajayValue> Fetch(
            SurveyChoiceFetchRequest request,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            requests.Add(request);
            return ValueTask.FromResult(CountryPayload());
        }
    }

    [Fact]
    public async Task AsyncFactorySettlesInitialChoiceSources()
    {
        SurveyDefinition definition = SurveyDefinition.Parse(Definition("{@catalog}/countries"))
            .Definition;

        Survey survey = await definition.CreateSurveyAsync(new SurveyOptions
        {
            ChoiceFetcher = (_, _) => ValueTask.FromResult(CountryPayload()),
            Endpoints = new Dictionary<string, string>
            {
                ["catalog"] = "in-process://catalog",
            },
        });

        SurveyChoiceQuestion question = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("country"));
        Assert.Equal(2, question.Choices.Count);
    }

    [Fact]
    public async Task CancellationLeavesAuthoredChoicesAndAllowsRetry()
    {
        int calls = 0;
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Survey survey = CreateSurvey(
            "resource/{region}",
            async (_, cancellationToken) =>
            {
                calls += 1;
                await release.Task.WaitAsync(cancellationToken);
                return CountryPayload();
            });
        using var cancellation = new CancellationTokenSource();

        Task pending = survey.SetValueAsync(
            "region",
            KajayValue.From("emea"),
            cancellation.Token);
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        SurveyChoiceQuestion question = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("country"));
        Assert.Equal([KajayValue.From("authored")], question.Choices);
        release.SetResult();
        await survey.SettleAsync();
        Assert.Equal(2, calls);
        Assert.Equal(2, question.Choices.Count);
    }

    [Fact]
    public async Task MissingEndpointFailsBeforeCallingTheAdapter()
    {
        bool called = false;
        Survey survey = CreateSurvey(
            "{@missing}/countries",
            (_, _) =>
            {
                called = true;
                return ValueTask.FromResult(CountryPayload());
            });

        SurveyChoiceLoadException failure = await Assert.ThrowsAsync<SurveyChoiceLoadException>(
            () => survey.SettleAsync());

        Assert.Equal("country", failure.QuestionName);
        Assert.Equal("{@missing}/countries", failure.Url);
        Assert.False(called);
    }

    private static Survey CreateSurvey(
        string url,
        SurveyChoiceFetcher fetcher,
        IReadOnlyDictionary<string, string>? endpoints = null,
        TimeProvider? timeProvider = null)
    {
        return SurveyDefinition.Parse(Definition(url)).Definition.CreateSurvey(new SurveyOptions
        {
            ChoiceFetcher = fetcher,
            Endpoints = endpoints ?? new Dictionary<string, string>(),
            TimeProvider = timeProvider ?? TimeProvider.System,
        });
    }

    private static string Definition(string url)
    {
        return $$"""
            {
              "pages":[{"name":"page","elements":[
                {"type":"text","name":"region"},
                {
                  "type":"dropdown",
                  "name":"country",
                  "choices":["authored"],
                  "choicesByUrl":{{System.Text.Json.JsonSerializer.Serialize(url)}},
                  "choicesPath":"data.items",
                  "choicesValueName":"id",
                  "choicesTitleName":"label"
                }
              ]}]
            }
            """;
    }

    private static KajayValue CountryPayload()
    {
        return KajayValue.FromObject([
            new("data", KajayValue.FromObject([
                new("items", KajayValue.FromArray([
                    Item("uk", "United Kingdom"),
                    Item("fr", "France"),
                ])),
            ])),
        ]);
    }

    private static KajayValue Item(string id, string label)
    {
        return KajayValue.FromObject([
            new("id", KajayValue.From(id)),
            new("label", KajayValue.From(label)),
        ]);
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
