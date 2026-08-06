namespace Kajay;

/// <summary>The host file operation that failed.</summary>
public enum SurveyFileOperation
{
    /// <summary>Storing newly attached files.</summary>
    Upload,

    /// <summary>Resolving a readable URL.</summary>
    Download,

    /// <summary>Releasing detached files.</summary>
    Cleanup,
}
