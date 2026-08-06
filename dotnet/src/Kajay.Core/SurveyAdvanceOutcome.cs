namespace Kajay;

/// <summary>Describes the result of the respondent's forward navigation action.</summary>
public enum SurveyAdvanceOutcome
{
    /// <summary>The survey moved to another page or completed.</summary>
    Advanced,

    /// <summary>Validation refused the move.</summary>
    Blocked,

    /// <summary>The survey was already complete, so nothing changed.</summary>
    NoChange,
}
