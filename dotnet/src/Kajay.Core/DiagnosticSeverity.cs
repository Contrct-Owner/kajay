namespace Kajay;

/// <summary>Classifies the effect of an authored definition problem.</summary>
public enum DiagnosticSeverity
{
    /// <summary>The definition remains usable, but the author should inspect it.</summary>
    Warning,

    /// <summary>The affected authored value could not be applied.</summary>
    Error,
}
