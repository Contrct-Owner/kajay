namespace Kajay;

/// <summary>A file question whose response is always an array of descriptors.</summary>
public sealed class SurveyFileQuestion : SurveyQuestion
{
    internal SurveyFileQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    private SurveyRuntimeFileSettings Settings => Definition.FileSettings!;

    /// <summary>Gets whether successive attachments accumulate.</summary>
    public bool AllowsMultiple => Settings.AllowMultiple;

    /// <summary>Gets immutable descriptors currently stored in the response.</summary>
    public IReadOnlyList<SurveyFileEntry> Files => Array.AsReadOnly(
        (Value.Kind == KajayValueKind.Array ? Value.GetArray() : Array.Empty<KajayValue>())
            .Select(value => SurveyFileEntry.TryFrom(value, out SurveyFileEntry? entry) ? entry : null)
            .OfType<SurveyFileEntry>()
            .ToArray());

    /// <summary>Stores descriptors after an adapter has read or uploaded the files.</summary>
    /// <param name="entries">DOM-free descriptors to attach.</param>
    public void Attach(IEnumerable<SurveyFileEntry> entries)
    {
        ArgumentNullException.ThrowIfNull(entries);
        SurveyFileEntry[] incoming = entries.ToArray();
        foreach (SurveyFileEntry entry in incoming)
        {
            ArgumentException.ThrowIfNullOrEmpty(entry.Name);
            ArgumentOutOfRangeException.ThrowIfNegative(entry.Size);
        }

        SurveyFileEntry[] stored = AllowsMultiple
            ? [.. Files, .. incoming]
            : incoming.Take(1).ToArray();
        SetValue(stored.Length == 0
            ? KajayValue.Absent
            : KajayValue.FromArray(stored.Select(entry => entry.ToValue(Settings.StoreContent))));
    }

    /// <summary>Removes every descriptor with an exact file name.</summary>
    public void Remove(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        SurveyFileEntry[] kept = Files.Where(
            entry => !string.Equals(entry.Name, name, StringComparison.Ordinal)).ToArray();
        SetValue(kept.Length == 0
            ? KajayValue.Absent
            : KajayValue.FromArray(kept.Select(entry => entry.ToValue(Settings.StoreContent))));
    }

    /// <summary>Removes all attached files.</summary>
    public void ClearFiles()
    {
        Clear();
    }
}
