using System.Collections.ObjectModel;

namespace Kajay;

/// <summary>A dynamic matrix or panel whose response is an ordered array of records.</summary>
public sealed class SurveyRecordQuestion : SurveyQuestion
{
    internal SurveyRecordQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    private SurveyRuntimeRecordSettings Settings => Definition.RecordSettings!;

    /// <summary>Gets the presented record count, including untouched minimum records.</summary>
    public int Count => Math.Max(Settings.MinimumCount, StoredRecords().Count);

    /// <summary>Gets whether another record may be added.</summary>
    public bool CanAdd => Settings.AllowAdd
        && (Settings.MaximumCount == 0 || Count < Settings.MaximumCount);

    /// <summary>Gets whether a record may be removed without crossing the minimum.</summary>
    public bool CanRemove => Settings.AllowRemove && Count > Settings.MinimumCount;

    /// <summary>Gets immutable record snapshots, including untouched minimum records.</summary>
    public IReadOnlyList<IReadOnlyDictionary<string, KajayValue>> Records
    {
        get
        {
            List<Dictionary<string, KajayValue>> records = Materialize();
            return Array.AsReadOnly(records.Select(record =>
                (IReadOnlyDictionary<string, KajayValue>)new ReadOnlyDictionary<string, KajayValue>(
                    record)).ToArray());
        }
    }

    /// <summary>Adds a materialized record using copy-previous or fixed defaults.</summary>
    /// <returns>True when a record was added.</returns>
    public bool Add()
    {
        if (!CanAdd)
        {
            return false;
        }

        List<Dictionary<string, KajayValue>> records = Materialize();
        Dictionary<string, KajayValue> added = Settings.CopyPrevious && records.Count > 0
            ? new Dictionary<string, KajayValue>(records[^1], StringComparer.Ordinal)
            : new Dictionary<string, KajayValue>(Settings.DefaultRecord.GetObject(), StringComparer.Ordinal);
        records.Add(added);
        Store(records);
        return true;
    }

    /// <summary>Removes one record and compacts every following index.</summary>
    /// <param name="index">The zero-based presented index.</param>
    /// <returns>True when the record was removed.</returns>
    public bool RemoveAt(int index)
    {
        if (!CanRemove || index < 0 || index >= Count)
        {
            return false;
        }

        List<Dictionary<string, KajayValue>> records = Materialize();
        records.RemoveAt(index);
        Store(records);
        return true;
    }

    /// <summary>Sets or clears one field in one presented record.</summary>
    public void SetField(int index, string name, KajayValue value)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        if (index < 0 || index >= Count)
        {
            throw new ArgumentOutOfRangeException(nameof(index));
        }

        List<Dictionary<string, KajayValue>> records = Materialize();
        if (value.Kind == KajayValueKind.Absent)
        {
            records[index].Remove(name);
        }
        else
        {
            records[index][name] = value;
        }

        Store(records);
    }

    private IReadOnlyList<KajayValue> StoredRecords()
    {
        return Value.Kind == KajayValueKind.Array ? Value.GetArray() : Array.Empty<KajayValue>();
    }

    private List<Dictionary<string, KajayValue>> Materialize()
    {
        List<Dictionary<string, KajayValue>> records = StoredRecords()
            .Select(record => record.Kind == KajayValueKind.Map
                ? new Dictionary<string, KajayValue>(record.GetObject(), StringComparer.Ordinal)
                : new Dictionary<string, KajayValue>(StringComparer.Ordinal))
            .ToList();
        while (records.Count < Count)
        {
            records.Add(new Dictionary<string, KajayValue>(StringComparer.Ordinal));
        }

        return records;
    }

    private void Store(IEnumerable<Dictionary<string, KajayValue>> records)
    {
        SetValue(KajayValue.FromArray(records.Select(KajayValue.FromObject)));
    }
}
