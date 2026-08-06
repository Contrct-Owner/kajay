namespace Kajay.Snapshots;

/// <summary>Reports a Response Snapshot format newer or older than this SDK supports.</summary>
public sealed class UnsupportedSurveySnapshotVersionException : Exception
{
    /// <summary>Initializes the exception.</summary>
    public UnsupportedSurveySnapshotVersionException(int declaredVersion)
        : base($"Response Snapshot format version {declaredVersion} is not supported.")
    {
        DeclaredVersion = declaredVersion;
    }

    /// <summary>Gets the unsupported format version.</summary>
    public int DeclaredVersion { get; }
}
