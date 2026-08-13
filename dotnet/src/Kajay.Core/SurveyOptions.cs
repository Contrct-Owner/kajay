namespace Kajay;

/// <summary>Host-provided services used by a new survey instance.</summary>
public sealed class SurveyOptions
{
    /// <summary>Gets or initializes the clock used by deterministic runtime features.</summary>
    public TimeProvider TimeProvider { get; init; } = TimeProvider.System;

    /// <summary>Gets or initializes the host-defined functions available to survey logic.</summary>
    public ExpressionFunctionRegistry ExpressionFunctions { get; init; } =
        ExpressionFunctionRegistry.Empty;

    /// <summary>Gets or initializes the adapter for definition-authored choice resources.</summary>
    public SurveyChoiceFetcher? ChoiceFetcher { get; init; }

    /// <summary>Gets or initializes the adapter for lazy, server-filtered choice pages.</summary>
    public SurveyChoicePageLoader? ChoicePageLoader { get; init; }

    /// <summary>Gets or initializes the adapter that stores attached files.</summary>
    public SurveyFileUploader? FileUploader { get; init; }

    /// <summary>Gets or initializes the adapter that resolves readable file URLs.</summary>
    public SurveyFileDownloader? FileDownloader { get; init; }

    /// <summary>Gets or initializes the adapter that cleans up detached files.</summary>
    public SurveyFileCleaner? FileCleaner { get; init; }

    /// <summary>Gets or initializes host-owned values addressed by <c>{$name}</c>.</summary>
    /// <remarks>
    /// The host's context, readable by every expression and belonging to none of the response.
    /// Supplied here rather than written with <see cref="Survey.SetValue"/> because that records
    /// an answer, which puts host configuration into the response data and the snapshot and lets
    /// the respondent overwrite it.
    /// </remarks>
    public IReadOnlyDictionary<string, KajayValue> HostValues { get; init; } =
        new Dictionary<string, KajayValue>(StringComparer.Ordinal);

    /// <summary>Gets or initializes host-owned origins addressed by <c>{@name}</c>.</summary>
    public IReadOnlyDictionary<string, string> Endpoints { get; init; } =
        new Dictionary<string, string>(StringComparer.Ordinal);

    /// <summary>Gets or initializes the synchronous host question validator.</summary>
    public SurveyQuestionValidator? QuestionValidator { get; init; }

    /// <summary>Gets or initializes the asynchronous host question validator.</summary>
    public AsyncSurveyQuestionValidator? AsyncQuestionValidator { get; init; }

    /// <summary>Gets or initializes the survey-wide host/server validator.</summary>
    public SurveyServerValidator? ServerValidator { get; init; }
}
