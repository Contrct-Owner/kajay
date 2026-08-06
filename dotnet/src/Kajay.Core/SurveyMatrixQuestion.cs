namespace Kajay;

/// <summary>A static matrix whose response is an object keyed by authored row value.</summary>
public sealed class SurveyMatrixQuestion : SurveyQuestion
{
    internal SurveyMatrixQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    /// <summary>Gets authored row values in stable definition order.</summary>
    public IReadOnlyList<KajayValue> Rows => Definition.Rows;

    /// <summary>Gets one row response, or <see cref="KajayValue.Absent"/>.</summary>
    public KajayValue GetRowValue(KajayValue row)
    {
        string key = ResolveRowKey(row);
        return Value.Kind == KajayValueKind.Map
            && Value.GetObject().TryGetValue(key, out KajayValue value)
                ? value
                : KajayValue.Absent;
    }

    /// <summary>Sets or clears one row without disturbing other rows.</summary>
    /// <param name="row">An authored row value.</param>
    /// <param name="value">Absent clears the row.</param>
    public void SetRowValue(KajayValue row, KajayValue value)
    {
        string key = ResolveRowKey(row);
        var response = Value.Kind == KajayValueKind.Map
            ? new Dictionary<string, KajayValue>(Value.GetObject(), StringComparer.Ordinal)
            : new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        if (value.Kind == KajayValueKind.Absent)
        {
            response.Remove(key);
        }
        else
        {
            response[key] = value;
        }

        SetValue(response.Count == 0 ? KajayValue.Absent : KajayValue.FromObject(response));
    }

    /// <summary>Gets one composite-matrix cell, or <see cref="KajayValue.Absent"/>.</summary>
    public KajayValue GetCellValue(KajayValue row, string column)
    {
        ArgumentException.ThrowIfNullOrEmpty(column);
        KajayValue record = GetRowValue(row);
        return record.Kind == KajayValueKind.Map
            && record.GetObject().TryGetValue(column, out KajayValue value)
                ? value
                : KajayValue.Absent;
    }

    /// <summary>Sets or clears one field in one composite-matrix row.</summary>
    public void SetCellValue(KajayValue row, string column, KajayValue value)
    {
        ArgumentException.ThrowIfNullOrEmpty(column);
        if (Type != "matrixcells")
        {
            throw new InvalidOperationException($"Question '{Name}' has scalar matrix rows.");
        }

        KajayValue current = GetRowValue(row);
        var record = current.Kind == KajayValueKind.Map
            ? new Dictionary<string, KajayValue>(current.GetObject(), StringComparer.Ordinal)
            : new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        if (value.Kind == KajayValueKind.Absent)
        {
            record.Remove(column);
        }
        else
        {
            record[column] = value;
        }

        SetRowValue(row, record.Count == 0 ? KajayValue.Absent : KajayValue.FromObject(record));
    }

    private string ResolveRowKey(KajayValue row)
    {
        KajayValue resolved = Rows.FirstOrDefault(
            candidate => KajayExpressionEquality.Equals(candidate, row));
        if (resolved.Kind == KajayValueKind.Absent || !KajayText.TryConvert(resolved, out string key))
        {
            throw new ArgumentException(
                $"Value is not an authored row for question '{Name}'.",
                nameof(row));
        }

        return key;
    }
}
