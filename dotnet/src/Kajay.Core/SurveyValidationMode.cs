namespace Kajay;

/// <summary>Controls when forward navigation validates respondent answers.</summary>
public enum SurveyValidationMode
{
    /// <summary>Validate the current page before each forward move.</summary>
    OnNextPage,

    /// <summary>Validate a changed question synchronously as its answer changes.</summary>
    OnValueChanged,

    /// <summary>Defer validation of every reachable question until final completion.</summary>
    OnComplete,
}
