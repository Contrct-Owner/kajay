namespace Kajay;

/// <summary>Deterministic survey clocks advanced by an explicit host tick.</summary>
public sealed class SurveyTimer
{
    private readonly Survey _survey;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _surveyLimit;
    private DateTimeOffset? _surveyStartedAt;

    internal SurveyTimer(
        Survey survey,
        TimeProvider timeProvider,
        TimeSpan surveyLimit)
    {
        _survey = survey;
        _timeProvider = timeProvider;
        _surveyLimit = surveyLimit;
    }

    /// <summary>Gets whether the clocks have been started and not stopped.</summary>
    public bool IsRunning => _surveyStartedAt.HasValue;

    /// <summary>Starts the clocks once; starting an active timer is idempotent.</summary>
    public void Start()
    {
        _surveyStartedAt ??= _timeProvider.GetUtcNow();
    }

    /// <summary>Reads elapsed time and applies any deadline reached.</summary>
    public void Tick()
    {
        if (!_surveyStartedAt.HasValue || _survey.IsCompleted)
        {
            return;
        }

        TimeSpan elapsed = _timeProvider.GetUtcNow() - _surveyStartedAt.Value;
        if (_surveyLimit > TimeSpan.Zero && elapsed >= _surveyLimit)
        {
            Stop();
            _survey.Complete();
        }
    }

    internal void Stop()
    {
        _surveyStartedAt = null;
    }
}
