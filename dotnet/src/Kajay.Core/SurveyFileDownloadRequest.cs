namespace Kajay;

/// <summary>An immutable request to resolve one file's current readable URL.</summary>
public sealed class SurveyFileDownloadRequest
{
    internal SurveyFileDownloadRequest(
        string questionName,
        SurveyFileEntry file,
        DateTimeOffset clock)
    {
        QuestionName = questionName;
        File = file;
        Clock = clock.ToUniversalTime();
    }

    /// <summary>Gets the exact authored question name.</summary>
    public string QuestionName { get; }

    /// <summary>Gets the immutable file descriptor.</summary>
    public SurveyFileEntry File { get; }

    /// <summary>Gets the explicit UTC clock captured for this operation.</summary>
    public DateTimeOffset Clock { get; }
}
