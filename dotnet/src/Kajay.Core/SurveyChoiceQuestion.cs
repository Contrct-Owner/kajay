namespace Kajay;

/// <summary>A question whose authored values form a selectable set or ordered list.</summary>
public sealed class SurveyChoiceQuestion : SurveyQuestion
{
    internal SurveyChoiceQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    /// <summary>Gets the authored values in stable definition order.</summary>
    public IReadOnlyList<KajayValue> Choices => Definition.Choices;

    /// <summary>Gets whether the response is an ordered array rather than one scalar.</summary>
    public bool AllowsMultiple => Type is "checkbox" or "tagbox" or "ranking";

    /// <summary>Reports whether the current response contains an authored choice.</summary>
    /// <param name="choice">A value matched with Kajay equality.</param>
    /// <returns>True when selected.</returns>
    public bool IsSelected(KajayValue choice)
    {
        KajayValue resolved = Resolve(choice);
        return AllowsMultiple
            ? Value.Kind == KajayValueKind.Array
                && Value.GetArray().Any(item => KajayExpressionEquality.Equals(item, resolved))
            : KajayExpressionEquality.Equals(Value, resolved);
    }

    /// <summary>Selects one authored value without duplicating an existing selection.</summary>
    /// <param name="choice">A value matched with Kajay equality.</param>
    public void Select(KajayValue choice)
    {
        KajayValue resolved = Resolve(choice);
        if (!AllowsMultiple)
        {
            SetValue(resolved);
            return;
        }

        List<KajayValue> selected = Value.Kind == KajayValueKind.Array
            ? Value.GetArray().ToList()
            : [];
        if (!selected.Any(item => KajayExpressionEquality.Equals(item, resolved)))
        {
            selected.Add(resolved);
            SetValue(KajayValue.FromArray(selected));
        }
    }

    /// <summary>Removes one selected value and removes an empty array response.</summary>
    /// <param name="choice">A value matched with Kajay equality.</param>
    public void Deselect(KajayValue choice)
    {
        KajayValue resolved = Resolve(choice);
        if (!AllowsMultiple)
        {
            if (KajayExpressionEquality.Equals(Value, resolved))
            {
                Clear();
            }

            return;
        }

        if (Value.Kind != KajayValueKind.Array)
        {
            return;
        }

        KajayValue[] remaining = Value.GetArray()
            .Where(item => !KajayExpressionEquality.Equals(item, resolved))
            .ToArray();
        SetValue(remaining.Length == 0 ? KajayValue.Absent : KajayValue.FromArray(remaining));
    }

    /// <summary>Replaces a multiple-choice or ranking response in caller-supplied order.</summary>
    /// <param name="choices">Authored values matched with Kajay equality.</param>
    public void SetSelection(IEnumerable<KajayValue> choices)
    {
        ArgumentNullException.ThrowIfNull(choices);
        if (!AllowsMultiple)
        {
            throw new InvalidOperationException($"Question '{Name}' accepts one choice.");
        }

        var selected = new List<KajayValue>();
        foreach (KajayValue choice in choices)
        {
            KajayValue resolved = Resolve(choice);
            if (!selected.Any(item => KajayExpressionEquality.Equals(item, resolved)))
            {
                selected.Add(resolved);
            }
        }

        SetValue(selected.Count == 0 ? KajayValue.Absent : KajayValue.FromArray(selected));
    }

    private KajayValue Resolve(KajayValue choice)
    {
        foreach (KajayValue authored in Choices)
        {
            if (KajayExpressionEquality.Equals(authored, choice))
            {
                return authored;
            }
        }

        throw new ArgumentException(
            $"Value is not an authored choice for question '{Name}'.",
            nameof(choice));
    }
}
