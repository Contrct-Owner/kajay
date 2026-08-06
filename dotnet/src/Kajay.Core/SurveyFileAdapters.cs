namespace Kajay;

internal sealed class SurveyFileAdapters(SurveyOptions options)
{
    private readonly TimeProvider _timeProvider = options.TimeProvider;
    private readonly SurveyFileUploader? _uploader = options.FileUploader;
    private readonly SurveyFileDownloader? _downloader = options.FileDownloader;
    private readonly SurveyFileCleaner? _cleaner = options.FileCleaner;

    public bool HasUploader => _uploader is not null;

    public bool HasDownloader => _downloader is not null;

    public bool HasCleaner => _cleaner is not null;

    public async Task<IReadOnlyList<SurveyFileEntry>> UploadAsync(
        string questionName,
        IReadOnlyList<SurveyFileEntry> files,
        CancellationToken cancellationToken)
    {
        var request = new SurveyFileRequest(
            questionName,
            files,
            _timeProvider.GetUtcNow());
        try
        {
            IReadOnlyList<SurveyFileEntry> uploaded = await _uploader!(
                request,
                cancellationToken).ConfigureAwait(false);
            return Snapshot(uploaded);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new SurveyFileTransferException(
                questionName,
                SurveyFileOperation.Upload,
                exception);
        }
    }

    private static System.Collections.ObjectModel.ReadOnlyCollection<SurveyFileEntry> Snapshot(
        IReadOnlyList<SurveyFileEntry> files)
    {
        ArgumentNullException.ThrowIfNull(files);
        SurveyFileEntry[] copy = files.Select(file =>
        {
            ArgumentNullException.ThrowIfNull(file);
            ArgumentException.ThrowIfNullOrEmpty(file.Name);
            ArgumentNullException.ThrowIfNull(file.MediaType);
            ArgumentOutOfRangeException.ThrowIfNegative(file.Size);
            return file;
        }).ToArray();
        return Array.AsReadOnly(copy);
    }

    public async Task<string> DownloadAsync(
        string questionName,
        SurveyFileEntry file,
        CancellationToken cancellationToken)
    {
        var request = new SurveyFileDownloadRequest(
            questionName,
            file,
            _timeProvider.GetUtcNow());
        try
        {
            string url = await _downloader!(request, cancellationToken).ConfigureAwait(false);
            ArgumentNullException.ThrowIfNull(url);
            return url;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new SurveyFileTransferException(
                questionName,
                SurveyFileOperation.Download,
                exception);
        }
    }

    public async Task CleanAsync(
        string questionName,
        IReadOnlyList<SurveyFileEntry> files,
        CancellationToken cancellationToken)
    {
        if (_cleaner is null || files.Count == 0)
        {
            return;
        }

        var request = new SurveyFileRequest(
            questionName,
            files,
            _timeProvider.GetUtcNow());
        try
        {
            await _cleaner(request, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new SurveyFileTransferException(
                questionName,
                SurveyFileOperation.Cleanup,
                exception);
        }
    }
}
