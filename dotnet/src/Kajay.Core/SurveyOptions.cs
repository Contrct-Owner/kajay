namespace Kajay;

/// <summary>Host-provided services used by a new survey instance.</summary>
public sealed class SurveyOptions
{
    /// <summary>Gets or initializes the clock used by deterministic runtime features.</summary>
    public TimeProvider TimeProvider { get; init; } = TimeProvider.System;
}
