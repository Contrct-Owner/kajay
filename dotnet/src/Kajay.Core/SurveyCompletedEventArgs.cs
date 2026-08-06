using System.Collections.ObjectModel;

namespace Kajay;

/// <summary>Provides an immutable answer snapshot when a survey completes.</summary>
public sealed class SurveyCompletedEventArgs : EventArgs
{
    internal SurveyCompletedEventArgs(
        IEnumerable<KeyValuePair<string, KajayValue>> data)
    {
        Data = new ReadOnlyDictionary<string, KajayValue>(
            new Dictionary<string, KajayValue>(data, StringComparer.Ordinal));
    }

    /// <summary>Gets the answer snapshot submitted by this completion.</summary>
    public IReadOnlyDictionary<string, KajayValue> Data { get; }
}
