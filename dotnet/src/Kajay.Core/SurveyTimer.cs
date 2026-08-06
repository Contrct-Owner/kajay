namespace Kajay;

/// <summary>Deterministic survey clocks advanced by an explicit host tick.</summary>
public sealed class SurveyTimer
{
    private readonly Survey _survey;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _surveyLimit;
    private readonly TimeSpan _defaultPageLimit;
    private readonly IReadOnlyList<TimeSpan> _pageLimits;
    private DateTimeOffset? _surveyStartedAt;
    private DateTimeOffset? _pageStartedAt;

    internal SurveyTimer(
        Survey survey,
        TimeProvider timeProvider,
        TimeSpan surveyLimit,
        TimeSpan defaultPageLimit,
        IReadOnlyList<TimeSpan> pageLimits)
    {
        _survey = survey;
        _timeProvider = timeProvider;
        _surveyLimit = surveyLimit;
        _defaultPageLimit = defaultPageLimit;
        _pageLimits = pageLimits;
    }

    /// <summary>Gets whether the clocks have been started and not stopped.</summary>
    public bool IsRunning => _surveyStartedAt.HasValue;

    /// <summary>Starts the clocks once; starting an active timer is idempotent.</summary>
    public void Start()
    {
        if (_surveyStartedAt.HasValue)
        {
            return;
        }

        DateTimeOffset now = _timeProvider.GetUtcNow();
        _surveyStartedAt = now;
        _pageStartedAt = now;
    }

    /// <summary>Reads elapsed time and applies any deadline reached.</summary>
    public void Tick()
    {
        if (!_surveyStartedAt.HasValue || _survey.IsCompleted)
        {
            return;
        }

        DateTimeOffset now = _timeProvider.GetUtcNow();
        if (HasExpired(_surveyStartedAt, _surveyLimit, now))
        {
            Stop();
            _survey.Complete();
            return;
        }

        if (HasExpired(_pageStartedAt, GetPageLimit(), now))
        {
            _survey.AdvanceFromTimer();
        }
    }

    internal void Stop()
    {
        _surveyStartedAt = null;
        _pageStartedAt = null;
    }

    internal void RestartPage()
    {
        if (IsRunning)
        {
            _pageStartedAt = _timeProvider.GetUtcNow();
        }
    }

    private TimeSpan GetPageLimit()
    {
        if (_survey.State != SurveyState.Running)
        {
            return TimeSpan.Zero;
        }

        int pageIndex = _survey.CurrentAuthoredPageIndex;
        TimeSpan ownLimit = pageIndex < _pageLimits.Count
            ? _pageLimits[pageIndex]
            : TimeSpan.Zero;
        return ownLimit > TimeSpan.Zero ? ownLimit : _defaultPageLimit;
    }

    private static bool HasExpired(
        DateTimeOffset? startedAt,
        TimeSpan limit,
        DateTimeOffset now)
    {
        return startedAt.HasValue
            && limit > TimeSpan.Zero
            && now - startedAt.Value >= limit;
    }
}
