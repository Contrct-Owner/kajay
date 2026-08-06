namespace Kajay.Hosting;

/// <summary>An immutable file batch handed to an upload or cleanup adapter.</summary>
public sealed class SurveyFileRequest
{
    internal SurveyFileRequest(
        string questionName,
        IEnumerable<SurveyFileEntry> files,
        DateTimeOffset clock)
    {
        QuestionName = questionName;
        Files = Array.AsReadOnly(files.ToArray());
        Clock = clock.ToUniversalTime();
    }

    /// <summary>Gets the exact authored question name.</summary>
    public string QuestionName { get; }

    /// <summary>Gets the immutable file descriptor snapshot.</summary>
    public IReadOnlyList<SurveyFileEntry> Files { get; }

    /// <summary>Gets the explicit UTC clock captured for this operation.</summary>
    public DateTimeOffset Clock { get; }
}
