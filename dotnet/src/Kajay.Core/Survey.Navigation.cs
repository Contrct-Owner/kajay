namespace Kajay;

public sealed partial class Survey
{
    /// <summary>Reports whether the named authored page is currently effective.</summary>
    /// <param name="pageName">The exact ordinal page name.</param>
    /// <returns>True only when a matching page exists and its condition is visible.</returns>
    public bool IsPageVisible(string pageName)
    {
        ArgumentNullException.ThrowIfNull(pageName);
        for (int index = 0; index < _definition.Pages.Count; index += 1)
        {
            if (string.Equals(_definition.Pages[index].Name, pageName, StringComparison.Ordinal))
            {
                return _conditions.IsPageVisible(index);
            }
        }

        return false;
    }

    /// <summary>Reports whether the host is waiting for external work.</summary>
    /// <param name="isLoading">Whether loading currently outranks other states.</param>
    public void SetLoading(bool isLoading)
    {
        if (_isLoading == isLoading)
        {
            return;
        }

        _isLoading = isLoading;
        RaiseStateChanged();
    }

    /// <summary>Moves from answering into a read-only completion preview.</summary>
    public void EnterPreview()
    {
        if (_isPreviewing || _isCompleted)
        {
            return;
        }

        _isPreviewing = true;
        RaiseStateChanged();
    }

    /// <summary>Returns from the completion preview to answering.</summary>
    public void CancelPreview()
    {
        if (!_isPreviewing)
        {
            return;
        }

        _isPreviewing = false;
        RaiseStateChanged();
    }

    /// <summary>Completes once, publishing data before the state transition.</summary>
    public void Complete()
    {
        if (_isCompleted)
        {
            return;
        }

        _isCompleted = true;
        _isPreviewing = false;
        Timer.Stop();
        if (!_isRestoringSnapshot)
        {
            Completed?.Invoke(this, new SurveyCompletedEventArgs(Data));
        }
        RaiseStateChanged();
    }

    /// <summary>Measures marks earned by the current reachable quiz questions.</summary>
    /// <returns>The current score without changing survey state.</returns>
    public QuizScore GetQuizScore()
    {
        return QuizScorer.Score(this, _definition);
    }

    /// <summary>
    /// Runs the cancellation-aware forward gate, then moves or completes when allowed.
    /// </summary>
    /// <param name="cancellationToken">Cancels pending validation or host work.</param>
    /// <returns>The committed navigation outcome.</returns>
    public async Task<SurveyAdvanceOutcome> AdvanceAsync(
        CancellationToken cancellationToken = default)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return await Task.FromCanceled<SurveyAdvanceOutcome>(
                cancellationToken).ConfigureAwait(false);
        }
        if (State != SurveyState.Running)
        {
            return SurveyAdvanceOutcome.NoChange;
        }

        string page = CurrentPageName;
        IReadOnlyDictionary<string, KajayValue> data = Data;
        SurveyValidationResult validation = await Validation.ValidateAdvanceAsync(
            IsLastPage,
            cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        if (!string.Equals(page, CurrentPageName, StringComparison.Ordinal)
            || !DataMatches(data, Data))
        {
            return SurveyAdvanceOutcome.NoChange;
        }
        if (!validation.IsValid)
        {
            return SurveyAdvanceOutcome.Blocked;
        }

        if (IsLastPage)
        {
            Complete();
        }
        else
        {
            SetCurrentPageIndex(_currentPageIndex + 1);
        }

        return SurveyAdvanceOutcome.Advanced;
    }

    /// <summary>Moves to the preceding effective page without running the forward gate.</summary>
    /// <returns>True when the current page changed.</returns>
    public bool MovePrevious()
    {
        return !_isCompleted && SetCurrentPageIndex(_currentPageIndex - 1);
    }

    /// <summary>Moves directly to an effective page by its authored name.</summary>
    /// <param name="pageName">The exact ordinal page name.</param>
    /// <returns>True when the current page changed.</returns>
    public bool GoToPage(string pageName)
    {
        ArgumentNullException.ThrowIfNull(pageName);
        if (_isCompleted)
        {
            return false;
        }

        for (int index = 0; index < _visiblePageIndexes.Length; index += 1)
        {
            int authoredIndex = _visiblePageIndexes[index];
            if (string.Equals(
                _definition.Pages[authoredIndex].Name,
                pageName,
                StringComparison.Ordinal))
            {
                return SetCurrentPageIndex(index);
            }
        }

        return false;
    }

    internal bool GoToPageOrQuestion(string name)
    {
        if (GoToPage(name))
        {
            return true;
        }

        for (int index = 0; index < _visiblePageIndexes.Length; index += 1)
        {
            if (_definition.Pages[_visiblePageIndexes[index]].ContainsQuestion(name))
            {
                return SetCurrentPageIndex(index);
            }
        }

        return false;
    }

    internal void AdvanceFromTimer()
    {
        if (_currentPageIndex + 1 < PageCount)
        {
            SetCurrentPageIndex(_currentPageIndex + 1);
            return;
        }

        Complete();
    }

    private SurveyState ResolveState()
    {
        if (_isLoading)
        {
            return SurveyState.Loading;
        }
        if (_isCompleted)
        {
            return SurveyState.Completed;
        }
        if (_isPreviewing)
        {
            return SurveyState.Preview;
        }

        return PageCount > 0 ? SurveyState.Running : SurveyState.Empty;
    }

    private void RaiseStateChanged()
    {
        if (!_isRestoringSnapshot)
        {
            StateChanged?.Invoke(this, new SurveyStateChangedEventArgs(State));
        }
    }

    private bool SetCurrentPageIndex(int pageIndex)
    {
        if (pageIndex < 0 || pageIndex >= PageCount || pageIndex == _currentPageIndex)
        {
            return false;
        }

        int previousPageIndex = _currentPageIndex;
        _currentPageIndex = pageIndex;
        Timer.RestartPage();
        if (!_isRestoringSnapshot)
        {
            CurrentPageChanged?.Invoke(
                this,
                new SurveyCurrentPageChangedEventArgs(previousPageIndex, pageIndex));
        }
        return true;
    }

    private void ClampCurrentPage()
    {
        if (PageCount > 0 && _currentPageIndex >= PageCount)
        {
            _ = SetCurrentPageIndex(PageCount - 1);
        }
    }
}
