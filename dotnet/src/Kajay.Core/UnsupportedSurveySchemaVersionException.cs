namespace Kajay;

/// <summary>Indicates that a definition targets a survey schema this package does not support.</summary>
public sealed class UnsupportedSurveySchemaVersionException : NotSupportedException
{
    /// <summary>Initializes an unsupported survey schema error.</summary>
    /// <param name="declaredVersion">The version declared by the definition.</param>
    public UnsupportedSurveySchemaVersionException(int declaredVersion)
        : base($"Survey schema version {declaredVersion} is not supported by this package.")
    {
        DeclaredVersion = declaredVersion;
    }

    /// <summary>Gets the unsupported version declared by the definition.</summary>
    public int DeclaredVersion { get; }
}
