namespace Kajay.Hosting;

/// <summary>A host file adapter failed an upload, download, or cleanup operation.</summary>
public sealed class SurveyFileTransferException : Exception
{
    internal SurveyFileTransferException(
        string questionName,
        SurveyFileOperation operation,
        Exception innerException)
        : base(
            $"The {operation} adapter failed for file question '{questionName}'.",
            innerException)
    {
        QuestionName = questionName;
        Operation = operation;
    }

    /// <summary>Gets the exact authored question name.</summary>
    public string QuestionName { get; }

    /// <summary>Gets the host operation that failed.</summary>
    public SurveyFileOperation Operation { get; }
}
