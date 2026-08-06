namespace Kajay.Hosting;

/// <summary>Stores files and returns the descriptors to place in the answer.</summary>
public delegate ValueTask<IReadOnlyList<SurveyFileEntry>> SurveyFileUploader(
    SurveyFileRequest request,
    CancellationToken cancellationToken);
