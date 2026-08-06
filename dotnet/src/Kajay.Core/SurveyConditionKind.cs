namespace Kajay;

/// <summary>Identifies one expression-derived element state.</summary>
public enum SurveyConditionKind
{
    /// <summary>Whether the element is shown.</summary>
    Visible,

    /// <summary>Whether the element accepts respondent input.</summary>
    Enabled,

    /// <summary>Whether the question requires an answer.</summary>
    Required,
}
