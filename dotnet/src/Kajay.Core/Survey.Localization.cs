namespace Kajay;

public sealed partial class Survey
{
    private string _locale;

    /// <summary>Gets the respondent locale used to resolve authored text.</summary>
    public string Locale => _locale;

    /// <summary>Gets the survey title resolved for the current locale.</summary>
    public string Title => ResolveText(_definition.Title);

    /// <summary>Gets the survey description resolved for the current locale.</summary>
    public string Description => ResolveText(_definition.Description);

    /// <summary>Gets the current page title, falling back to its name.</summary>
    public string CurrentPageTitle
    {
        get
        {
            if (PageCount == 0)
            {
                return string.Empty;
            }

            SurveyRuntimePage page = _definition.Pages[_visiblePageIndexes[_currentPageIndex]];
            string title = ResolveText(page.Title);
            return title.Length > 0 ? title : page.Name;
        }
    }

    /// <summary>Raised after the respondent locale changes.</summary>
    public event EventHandler<SurveyLocaleChangedEventArgs>? LocaleChanged;

    /// <summary>Changes the respondent locale without changing the authored definition.</summary>
    /// <param name="locale">A BCP 47 locale tag, or an empty string for default text.</param>
    public void SetLocale(string locale)
    {
        ArgumentNullException.ThrowIfNull(locale);
        if (SurveyLocalizedText.LocaleEquals(_locale, locale))
        {
            return;
        }

        _locale = locale;
        _choiceSources.SettleSynchronous();
        LocaleChanged?.Invoke(this, new SurveyLocaleChangedEventArgs(locale));
    }

    internal string ResolveText(SurveyLocalizedText text)
    {
        return text.Resolve(_locale);
    }
}
