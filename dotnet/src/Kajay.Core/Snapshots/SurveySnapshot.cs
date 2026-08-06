using System.Collections.ObjectModel;

namespace Kajay.Snapshots;

/// <summary>Portable, definition-bound state for one survey response.</summary>
public sealed class SurveySnapshot
{
    internal SurveySnapshot(
        string definitionDigest,
        IReadOnlyDictionary<string, KajayValue> data,
        string pageName,
        string locale,
        SurveyState lifecycle,
        SurveyTimerAnchors? timer)
    {
        DefinitionDigest = definitionDigest;
        Data = new ReadOnlyDictionary<string, KajayValue>(
            new Dictionary<string, KajayValue>(data, StringComparer.Ordinal));
        PageName = pageName;
        Locale = locale;
        Lifecycle = lifecycle;
        Timer = timer;
    }

    /// <summary>Gets the Response Snapshot format version.</summary>
    public int FormatVersion { get; } = 1;

    /// <summary>Gets the canonical survey definition identity.</summary>
    public string DefinitionDigest { get; }

    /// <summary>Gets the value-semantics conformance version.</summary>
    public int ConformanceVersion { get; } = 2;

    /// <summary>Gets respondent answers without calculated values.</summary>
    public IReadOnlyDictionary<string, KajayValue> Data { get; }

    /// <summary>Gets the authored page name, or an empty string for no page.</summary>
    public string PageName { get; }

    /// <summary>Gets the respondent locale.</summary>
    public string Locale { get; }

    /// <summary>Gets the durable survey lifecycle.</summary>
    public SurveyState Lifecycle { get; }

    /// <summary>Gets absolute timer anchors, or null when the timer is stopped.</summary>
    public SurveyTimerAnchors? Timer { get; }

    /// <summary>Parses and validates Response Snapshot Format v1 JSON.</summary>
    public static SurveySnapshot Parse(string json)
    {
        return SurveySnapshotJson.Parse(json);
    }

    /// <summary>Writes deterministic Response Snapshot Format v1 JSON.</summary>
    public string ToJson()
    {
        return SurveySnapshotJson.Write(this);
    }
}
