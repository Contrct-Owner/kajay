namespace Kajay.Hosting;

/// <summary>Deletes or otherwise releases files that left an answer.</summary>
public delegate ValueTask SurveyFileCleaner(
    SurveyFileRequest request,
    CancellationToken cancellationToken);
