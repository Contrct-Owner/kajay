namespace Kajay.Core.Tests;

public sealed class SurveyFileAdapterTests
{
    [Fact]
    public async Task UploadCommitsOnlyTheAdapterResultAndCapturesTheClock()
    {
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2032, 5, 6, 7, 8, 9, TimeSpan.Zero));
        SurveyFileRequest? observed = null;
        Survey survey = CreateSurvey(new SurveyOptions
        {
            TimeProvider = clock,
            FileUploader = (request, cancellationToken) =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                observed = request;
                SurveyFileEntry source = Assert.Single(request.Files);
                return ValueTask.FromResult<IReadOnlyList<SurveyFileEntry>>([
                    source with { Content = null, Url = $"stored://{source.Name}" },
                ]);
            },
        });
        SurveyFileQuestion question = GetQuestion(survey);

        await question.AttachAsync([Entry()]);

        Assert.Equal("receipt", observed?.QuestionName);
        Assert.Equal(clock.GetUtcNow(), observed?.Clock);
        SurveyFileEntry stored = Assert.Single(question.Files);
        Assert.Equal("stored://receipt.pdf", stored.Url);
        Assert.Null(stored.Content);
        Assert.Throws<InvalidOperationException>(() => question.Attach([Entry()]));
    }

    [Fact]
    public async Task FailedAndCancelledUploadsLeaveThePreviousAnswerAlone()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Survey survey = CreateSurvey(new SurveyOptions
        {
            FileUploader = async (_, cancellationToken) =>
            {
                await release.Task.WaitAsync(cancellationToken);
                throw new IOException("bucket full");
            },
        });
        SurveyFileQuestion question = GetQuestion(survey);
        using var cancellation = new CancellationTokenSource();

        Task pending = question.AttachAsync([Entry()], cancellation.Token);
        Assert.True(question.IsUploading);
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.False(question.IsUploading);
        Assert.Empty(question.Files);
        release.SetResult();
        SurveyFileTransferException failure = await Assert.ThrowsAsync<SurveyFileTransferException>(
            () => question.AttachAsync([Entry()]));
        Assert.Equal(SurveyFileOperation.Upload, failure.Operation);
        Assert.Empty(question.Files);
    }

    [Fact]
    public async Task DownloadAdapterOverridesStoredReferencesAndPropagatesCancellation()
    {
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2033, 6, 7, 8, 9, 10, TimeSpan.Zero));
        SurveyFileDownloadRequest? observed = null;
        Survey survey = CreateSurvey(new SurveyOptions
        {
            TimeProvider = clock,
            FileDownloader = (request, cancellationToken) =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                observed = request;
                return ValueTask.FromResult($"signed://{request.File.Name}");
            },
        });
        SurveyFileQuestion question = GetQuestion(survey);

        string url = await question.ResolveUrlAsync(Entry());

        Assert.Equal("signed://receipt.pdf", url);
        Assert.Equal("receipt", observed?.QuestionName);
        Assert.Equal(clock.GetUtcNow(), observed?.Clock);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => question.ResolveUrlAsync(Entry(), cancellation.Token));
    }

    [Fact]
    public async Task CleanupRunsAfterDetachmentAndItsFailureIsContextual()
    {
        Survey? survey = null;
        survey = CreateSurvey(new SurveyOptions
        {
            FileCleaner = (request, _) =>
            {
                Assert.Empty(GetQuestion(survey!).Files);
                Assert.Equal("receipt.pdf", Assert.Single(request.Files).Name);
                throw new IOException("permission denied");
            },
        });
        SurveyFileQuestion question = GetQuestion(survey);
        await question.AttachAsync([Entry()]);

        SurveyFileTransferException failure = await Assert.ThrowsAsync<SurveyFileTransferException>(
            () => question.RemoveAsync("receipt.pdf"));

        Assert.Equal(SurveyFileOperation.Cleanup, failure.Operation);
        Assert.Empty(question.Files);
        Assert.Throws<InvalidOperationException>(() => question.ClearFiles());
    }

    private static Survey CreateSurvey(SurveyOptions options)
    {
        return SurveyDefinition.Parse(
            """
            {"pages":[{"name":"page","elements":[{
              "type":"file",
              "name":"receipt",
              "allowMultiple":true,
              "storeDataAsText":true
            }]}]}
            """)
            .Definition
            .CreateSurvey(options);
    }

    private static SurveyFileQuestion GetQuestion(Survey survey)
    {
        return Assert.IsType<SurveyFileQuestion>(survey.GetQuestion("receipt"));
    }

    private static SurveyFileEntry Entry()
    {
        return new SurveyFileEntry(
            "receipt.pdf",
            "application/pdf",
            1024,
            "data:application/pdf;base64,AAAA");
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }
    }
}
