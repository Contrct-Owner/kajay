namespace Kajay.Hosting;

internal sealed class SurveyChoicePager
{
    private readonly SurveyChoiceQuestion _question;
    private readonly SurveyChoicePageLoader? _loader;
    private readonly TimeProvider _timeProvider;
    private readonly int _pageSize;
    private SurveyChoiceItem[] _items = [];
    private CancellationTokenSource? _requestCancellation;
    private Task? _pending;
    private int _generation;
    private bool _hasLoaded;

    public SurveyChoicePager(
        SurveyChoiceQuestion question,
        SurveyChoicePageLoader? loader,
        TimeProvider timeProvider)
    {
        _question = question;
        _loader = loader;
        _timeProvider = timeProvider;
        _pageSize = question.ChoiceSettings.LazyLoadPageSize > 0
            ? question.ChoiceSettings.LazyLoadPageSize
            : 25;
    }

    public bool IsLoading { get; private set; }

    public bool HasMore { get; private set; } = true;

    public string Filter { get; private set; } = string.Empty;

    public bool NeedsInitialLoad => !_hasLoaded;

    public Task EnsureInitialAsync(CancellationToken cancellationToken)
    {
        return _hasLoaded ? Task.CompletedTask : LoadMoreAsync(cancellationToken);
    }

    public Task LoadMoreAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (IsLoading)
        {
            return _pending ?? Task.CompletedTask;
        }
        if (!HasMore)
        {
            return Task.CompletedTask;
        }

        return StartAsync(_items.Length, cancellationToken);
    }

    public Task SetFilterAsync(string filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        cancellationToken.ThrowIfCancellationRequested();
        string trimmed = filter.Trim();
        if (string.Equals(Filter, trimmed, StringComparison.Ordinal))
        {
            return IsLoading ? _pending ?? Task.CompletedTask : Task.CompletedTask;
        }

        Filter = trimmed;
        _items = [];
        HasMore = true;
        _hasLoaded = false;
        _generation += 1;
        _requestCancellation?.Cancel();
        return StartAsync(0, cancellationToken);
    }

    private Task StartAsync(int skip, CancellationToken cancellationToken)
    {
        if (_loader is null)
        {
            return Task.FromException(new SurveyChoiceLoadException(
                _question.Name,
                string.Empty,
                $"Question '{_question.Name}' loads choices lazily but no ChoicePageLoader adapter was supplied."));
        }

        int generation = _generation;
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _requestCancellation = linked;
        _pending = completion.Task;
        IsLoading = true;
        _ = RunAsync(skip, generation, linked, completion);
        return completion.Task;
    }

    /// <summary>
    /// Loads one page, then settles this request's state <em>before</em> reporting it done.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The outcome is recorded rather than signalled inline, because the order of those two
    /// things is the whole point. This used to complete inside the <c>try</c> and clear
    /// <see cref="IsLoading"/> in a <c>finally</c>, which runs afterwards — and the
    /// completion source hands out its continuations asynchronously, so a caller awaiting
    /// <see cref="SetFilterAsync"/> was released while the flag was still set and raced the
    /// <c>finally</c> to read it. `await SetChoiceFilterAsync(…)` followed by a read of
    /// `IsLoadingChoices` could see the state from before its own request finished.
    /// </para>
    /// <para>
    /// It is not a test-only fault and it does not reproduce on demand: it is whichever of
    /// two thread-pool items runs first, so it passes on a quiet machine and fails on a busy
    /// one. Settling first removes the race rather than narrowing it.
    /// </para>
    /// </remarks>
    private async Task RunAsync(
        int skip,
        int generation,
        CancellationTokenSource cancellation,
        TaskCompletionSource completion)
    {
        OperationCanceledException? cancelled = null;
        Exception? failure = null;
        try
        {
            var request = new SurveyChoicePageRequest(
                _question.Name,
                skip,
                _pageSize,
                Filter,
                _timeProvider.GetUtcNow());
            SurveyChoicePage page = await _loader!(request, cancellation.Token)
                .ConfigureAwait(false);
            Apply(generation, page);
        }
        catch (OperationCanceledException exception)
        {
            cancelled = exception;
        }
        catch (Exception exception)
        {
            failure = new SurveyChoiceLoadException(
                _question.Name,
                string.Empty,
                $"Loading a choice page for question '{_question.Name}' failed.",
                exception);
        }

        Complete(generation, cancellation);

        if (cancelled is not null)
        {
            completion.SetCanceled(cancelled.CancellationToken);
        }
        else if (failure is not null)
        {
            completion.SetException(failure);
        }
        else
        {
            completion.SetResult();
        }
    }

    private void Apply(int generation, SurveyChoicePage page)
    {
        ArgumentNullException.ThrowIfNull(page);
        ArgumentNullException.ThrowIfNull(page.Items);
        if (generation != _generation)
        {
            return;
        }

        SurveyChoiceItem[] additions = page.Items.Select(item =>
        {
            ArgumentNullException.ThrowIfNull(item);
            ArgumentNullException.ThrowIfNull(item.Text);
            return item;
        }).ToArray();
        _items = [.. _items, .. additions];
        HasMore = page.HasMore;
        _hasLoaded = true;
        _question.SetChoices(_items);
    }

    private void Complete(int generation, CancellationTokenSource cancellation)
    {
        if (generation == _generation)
        {
            IsLoading = false;
            _pending = null;
            _requestCancellation = null;
        }

        cancellation.Dispose();
    }
}
