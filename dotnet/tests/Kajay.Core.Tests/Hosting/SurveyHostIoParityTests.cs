namespace Kajay.Core.Tests;

public sealed class SurveyHostIoParityTests
{
    [Fact(DisplayName = "parity/Q8-host-io")]
    public async Task HostIoIsExplicitClockedAndCancellationAware()
    {
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2034, 7, 8, 9, 10, 11, TimeSpan.Zero));
        var host = new InProcessHost();
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            "lookup",
            host.LookupAsync);
        Survey survey = SurveyDefinition.Parse(Definition()).Definition.CreateSurvey(
            new SurveyOptions
            {
                TimeProvider = clock,
                ExpressionFunctions = functions,
                ChoiceFetcher = host.FetchChoicesAsync,
                Endpoints = new Dictionary<string, string>
                {
                    ["catalog"] = "in-process://catalog",
                },
                FileUploader = host.UploadAsync,
                FileDownloader = host.DownloadAsync,
                FileCleaner = host.CleanAsync,
            });

        await survey.SetValueAsync("region", KajayValue.From("north west"));
        SurveyChoiceQuestion country = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("country"));
        Assert.Equal([KajayValue.From("gb")], country.Choices);
        Assert.True(survey.IsPageVisible("branch"));
        Assert.Equal("in-process://catalog/north%20west", host.ChoiceRequest?.Url);

        SurveyFileQuestion receipt = Assert.IsType<SurveyFileQuestion>(
            survey.GetQuestion("receipt"));
        await receipt.AttachAsync([Entry()]);
        Assert.Equal("stored://receipt.pdf", Assert.Single(receipt.Files).Url);
        Assert.Equal("signed://receipt.pdf", await receipt.ResolveUrlAsync(receipt.Files[0]));
        await receipt.RemoveAsync("receipt.pdf");
        Assert.Equal(["receipt.pdf"], host.CleanedNames);
        Assert.All(host.Clocks, observed => Assert.Equal(clock.GetUtcNow(), observed));

        host.BlockDownloads = true;
        using var cancellation = new CancellationTokenSource();
        Task pending = receipt.ResolveUrlAsync(Entry(), cancellation.Token);
        await host.DownloadStarted.Task;
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
    }

    private static SurveyFileEntry Entry()
    {
        return new SurveyFileEntry(
            "receipt.pdf",
            "application/pdf",
            4,
            "data:application/pdf;base64,AAAA");
    }

    private static string Definition()
    {
        return """
            {
              "calculatedValues":[
                {"name":"status","expression":"lookup({region})","includeIntoResult":true}
              ],
              "pages":[
                {"name":"start","elements":[
                  {"type":"text","name":"region"},
                  {
                    "type":"dropdown",
                    "name":"country",
                    "choicesByUrl":"{@catalog}/{region}",
                    "choicesValueName":"code",
                    "choicesTitleName":"title"
                  },
                  {"type":"file","name":"receipt"}
                ]},
                {"name":"branch","visibleIf":"{status} = 'ready'"}
              ]
            }
            """;
    }

    private sealed class InProcessHost
    {
        public List<DateTimeOffset> Clocks { get; } = [];

        public List<string> CleanedNames { get; } = [];

        public SurveyChoiceFetchRequest? ChoiceRequest { get; private set; }

        public bool BlockDownloads { get; set; }

        public TaskCompletionSource DownloadStarted { get; } = new(
            TaskCreationOptions.RunContinuationsAsynchronously);

        public ValueTask<KajayValue> LookupAsync(
            IReadOnlyList<KajayValue> arguments,
            ExpressionFunctionContext context,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Clocks.Add(context.Clock);
            return ValueTask.FromResult(arguments[0].Kind == KajayValueKind.Text
                ? KajayValue.From("ready")
                : KajayValue.Absent);
        }

        public ValueTask<KajayValue> FetchChoicesAsync(
            SurveyChoiceFetchRequest request,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            ChoiceRequest = request;
            Clocks.Add(request.Clock);
            return ValueTask.FromResult(KajayValue.FromArray([
                KajayValue.FromObject([
                    new("code", KajayValue.From("gb")),
                    new("title", KajayValue.From("United Kingdom")),
                ]),
            ]));
        }

        public ValueTask<IReadOnlyList<SurveyFileEntry>> UploadAsync(
            SurveyFileRequest request,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Clocks.Add(request.Clock);
            SurveyFileEntry file = Assert.Single(request.Files);
            return ValueTask.FromResult<IReadOnlyList<SurveyFileEntry>>([
                file with { Content = null, Url = $"stored://{file.Name}" },
            ]);
        }

        public async ValueTask<string> DownloadAsync(
            SurveyFileDownloadRequest request,
            CancellationToken cancellationToken)
        {
            Clocks.Add(request.Clock);
            if (BlockDownloads)
            {
                DownloadStarted.SetResult();
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            }

            return $"signed://{request.File.Name}";
        }

        public ValueTask CleanAsync(
            SurveyFileRequest request,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Clocks.Add(request.Clock);
            CleanedNames.AddRange(request.Files.Select(file => file.Name));
            return ValueTask.CompletedTask;
        }
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
