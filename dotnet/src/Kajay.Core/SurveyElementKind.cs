namespace Kajay;

/// <summary>Identifies the definition object whose computed state changed.</summary>
public enum SurveyElementKind
{
    /// <summary>An authored survey page.</summary>
    Page,

    /// <summary>An element that stores an answer.</summary>
    Question,

    /// <summary>A grouping element containing other elements.</summary>
    Panel,

    /// <summary>A non-answer display element.</summary>
    Element,
}
