namespace Kajay;

/// <summary>Describes a committed respondent-locale change.</summary>
public sealed class SurveyLocaleChangedEventArgs : EventArgs
{
    /// <summary>Initializes a locale-change notification.</summary>
    /// <param name="locale">The new BCP 47 locale tag.</param>
    public SurveyLocaleChangedEventArgs(string locale)
    {
        ArgumentNullException.ThrowIfNull(locale);
        Locale = locale;
    }

    /// <summary>Gets the new locale tag.</summary>
    public string Locale { get; }
}
