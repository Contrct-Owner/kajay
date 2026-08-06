namespace Kajay.Hosting;

/// <summary>Resolves a current readable URL for one stored file.</summary>
public delegate ValueTask<string> SurveyFileDownloader(
    SurveyFileDownloadRequest request,
    CancellationToken cancellationToken);
