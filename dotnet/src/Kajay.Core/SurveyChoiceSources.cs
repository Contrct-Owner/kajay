namespace Kajay;

internal sealed class SurveyChoiceSources
{
    private readonly SurveyChoiceFetcher? _fetcher;
    private readonly TimeProvider _timeProvider;
    private readonly SurveyChoiceUrlResolver _urlResolver;
    private readonly IReadOnlyList<SurveyChoiceQuestion> _questions;
    private readonly Dictionary<string, SurveyChoiceQuestion> _questionsByName;
    private readonly IReadOnlyList<SurveyChoicePager> _pagers;
    private readonly Dictionary<SurveyChoiceCacheKey, IReadOnlyList<SurveyChoiceItem>> _cache = [];
    private readonly Dictionary<SurveyChoiceCacheKey, Task<IReadOnlyList<SurveyChoiceItem>>> _pending = [];
    private readonly Dictionary<string, SurveyChoiceCacheKey> _applied = new(StringComparer.Ordinal);

    public SurveyChoiceSources(
        Survey survey,
        SurveyOptions options,
        IReadOnlyList<SurveyChoiceQuestion> questions)
    {
        _fetcher = options.ChoiceFetcher;
        _timeProvider = options.TimeProvider;
        _urlResolver = new SurveyChoiceUrlResolver(survey, CopyEndpoints(options.Endpoints));
        _questions = questions;
        _questionsByName = questions
            .GroupBy(question => question.Name, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
        _pagers = Array.AsReadOnly(questions
            .Where(IsPagedSource)
            .Select(question => CreatePager(question, options))
            .ToArray());
    }

    public async Task<bool> SettleAsync(CancellationToken cancellationToken)
    {
        Task<bool>[] urlLoads = _questions
            .Where(question => question.ChoiceSettings.FromQuestion.Length == 0
                && question.ChoiceSettings.Url.Length > 0)
            .Select(question => LoadAsync(question, cancellationToken))
            .ToArray();
        bool loadsInitialPage = _pagers.Any(pager => pager.NeedsInitialLoad);
        Task[] pageLoads = _pagers
            .Select(pager => pager.EnsureInitialAsync(cancellationToken))
            .ToArray();
        if (urlLoads.Length == 0 && pageLoads.Length == 0)
        {
            return false;
        }

        bool[] outcomes = await Task.WhenAll(urlLoads).ConfigureAwait(false);
        await Task.WhenAll(pageLoads).ConfigureAwait(false);
        return loadsInitialPage || outcomes.Any(changed => changed);
    }

    public void SettleSynchronous()
    {
        for (int pass = 0; pass < 128; pass += 1)
        {
            bool changed = false;
            foreach (SurveyChoiceQuestion target in _questions)
            {
                SurveyRuntimeChoiceSettings settings = target.ChoiceSettings;
                if (settings.FromQuestion.Length > 0)
                {
                    changed |= ApplyCarryForward(target, settings);
                }
            }

            if (!changed)
            {
                return;
            }
        }

        throw new InvalidOperationException("Carry-forward choice sources did not converge.");
    }

    private async Task<bool> LoadAsync(
        SurveyChoiceQuestion question,
        CancellationToken cancellationToken)
    {
        SurveyRuntimeChoiceSettings settings = question.ChoiceSettings;
        string url = _urlResolver.Resolve(question.Name, settings.Url);
        if (url.Trim().Length == 0)
        {
            _applied.Remove(question.Name);
            return question.ResetChoices();
        }

        var key = new SurveyChoiceCacheKey(
            url,
            settings.Path,
            settings.ValueName,
            settings.TitleName);
        if (_applied.GetValueOrDefault(question.Name) == key)
        {
            return false;
        }

        IReadOnlyList<SurveyChoiceItem> choices = await GetAsync(
            question.Name,
            key,
            cancellationToken).ConfigureAwait(false);
        if (_urlResolver.Resolve(question.Name, settings.Url) != url)
        {
            return false;
        }

        _applied[question.Name] = key;
        return question.SetChoices(choices);
    }

    private async Task<IReadOnlyList<SurveyChoiceItem>> GetAsync(
        string questionName,
        SurveyChoiceCacheKey key,
        CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(key, out IReadOnlyList<SurveyChoiceItem>? cached))
        {
            return cached;
        }
        if (_fetcher is null)
        {
            throw new SurveyChoiceLoadException(
                questionName,
                key.Url,
                "The survey has a URL-backed choice source but no ChoiceFetcher adapter.");
        }

        if (!_pending.TryGetValue(key, out Task<IReadOnlyList<SurveyChoiceItem>>? pending))
        {
            pending = FetchAsync(questionName, key, cancellationToken);
            _pending.Add(key, pending);
        }

        try
        {
            return await pending.ConfigureAwait(false);
        }
        finally
        {
            _pending.Remove(key);
        }
    }

    private async Task<IReadOnlyList<SurveyChoiceItem>> FetchAsync(
        string questionName,
        SurveyChoiceCacheKey key,
        CancellationToken cancellationToken)
    {
        try
        {
            var request = new SurveyChoiceFetchRequest(
                questionName,
                key.Url,
                _timeProvider.GetUtcNow());
            KajayValue payload = await _fetcher!(request, cancellationToken).ConfigureAwait(false);
            IReadOnlyList<SurveyChoiceItem> choices = SurveyChoiceResponseMapper.Map(
                payload,
                key,
                questionName);
            _cache.Add(key, choices);
            return choices;
        }
        catch (Exception exception) when (exception is not OperationCanceledException
            and not SurveyChoiceLoadException)
        {
            throw new SurveyChoiceLoadException(
                questionName,
                key.Url,
                $"Loading choices for question '{questionName}' failed.",
                exception);
        }
    }

    private static Dictionary<string, string> CopyEndpoints(
        IReadOnlyDictionary<string, string> endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        var copy = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach ((string name, string value) in endpoints)
        {
            ArgumentException.ThrowIfNullOrEmpty(name);
            ArgumentNullException.ThrowIfNull(value);
            copy.Add(name, value);
        }

        return copy;
    }

    private static bool IsPagedSource(SurveyChoiceQuestion question)
    {
        SurveyRuntimeChoiceSettings settings = question.ChoiceSettings;
        return settings.FromQuestion.Length == 0
            && settings.Url.Length == 0
            && settings.LazyLoadEnabled;
    }

    private static SurveyChoicePager CreatePager(
        SurveyChoiceQuestion question,
        SurveyOptions options)
    {
        var pager = new SurveyChoicePager(
            question,
            options.ChoicePageLoader,
            options.TimeProvider);
        question.AttachChoicePager(pager);
        return pager;
    }

    private bool ApplyCarryForward(
        SurveyChoiceQuestion target,
        SurveyRuntimeChoiceSettings settings)
    {
        if (!_questionsByName.TryGetValue(
            settings.FromQuestion,
            out SurveyChoiceQuestion? source))
        {
            return target.ResetChoices();
        }

        IReadOnlyList<SurveyChoiceItem> choices = source.ChoiceItems;
        if (settings.FromQuestionMode is not ("selected" or "unselected"))
        {
            return target.SetChoices(choices);
        }

        KajayValue answer = source.Value;
        SurveyChoiceItem[] derived = choices
            .Where(choice => settings.FromQuestionMode == "selected"
                ? Contains(answer, choice.Value)
                : !Contains(answer, choice.Value))
            .ToArray();
        return target.SetChoices(Array.AsReadOnly(derived));
    }

    private static bool Contains(KajayValue answer, KajayValue choice)
    {
        return answer.Kind == KajayValueKind.Array
            ? answer.GetArray().Any(selected =>
                KajayExpressionEquality.Equals(selected, choice))
            : KajayExpressionEquality.Equals(answer, choice);
    }
}
