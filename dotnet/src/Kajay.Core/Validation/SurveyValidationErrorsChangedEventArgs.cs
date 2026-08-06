namespace Kajay.Validation;

/// <summary>Describes the complete retained validation-error snapshot after a change.</summary>
public sealed class SurveyValidationErrorsChangedEventArgs : EventArgs
{
    internal SurveyValidationErrorsChangedEventArgs(
        IReadOnlyList<SurveyValidationError> errors)
    {
        Errors = errors;
    }

    /// <summary>Gets every currently retained validation error in definition order.</summary>
    public IReadOnlyList<SurveyValidationError> Errors { get; }
}
