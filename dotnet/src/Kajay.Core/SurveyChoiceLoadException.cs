namespace Kajay;

/// <summary>A choice source could not be resolved, loaded, or converted.</summary>
public sealed class SurveyChoiceLoadException : Exception
{
    internal SurveyChoiceLoadException(
        string questionName,
        string url,
        string message,
        Exception? innerException = null)
        : base(message, innerException)
    {
        QuestionName = questionName;
        Url = url;
    }

    /// <summary>Gets the exact authored question name.</summary>
    public string QuestionName { get; }

    /// <summary>Gets the resolved URL, or the unresolved template when resolution failed.</summary>
    public string Url { get; }
}
