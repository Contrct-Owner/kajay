namespace Kajay;

/// <summary>Host-provided services used by a new survey instance.</summary>
public sealed class SurveyOptions
{
    /// <summary>Gets or initializes the clock used by deterministic runtime features.</summary>
    public TimeProvider TimeProvider { get; init; } = TimeProvider.System;

    /// <summary>Gets or initializes the host-defined functions available to survey logic.</summary>
    public ExpressionFunctionRegistry ExpressionFunctions { get; init; } =
        ExpressionFunctionRegistry.Empty;

    /// <summary>Gets or initializes the synchronous host question validator.</summary>
    public SurveyQuestionValidator? QuestionValidator { get; init; }

    /// <summary>Gets or initializes the asynchronous host question validator.</summary>
    public AsyncSurveyQuestionValidator? AsyncQuestionValidator { get; init; }

    /// <summary>Gets or initializes the survey-wide host/server validator.</summary>
    public SurveyServerValidator? ServerValidator { get; init; }
}
