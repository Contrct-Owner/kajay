namespace Kajay;

/// <summary>A signature stored as an inline data string.</summary>
public sealed class SurveySignatureQuestion : SurveyQuestion
{
    internal SurveySignatureQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    private SurveyRuntimeSignatureSettings Settings => Definition.SignatureSettings!;

    /// <summary>Gets the definition-selected ink color.</summary>
    public string PenColor => Settings.PenColor;

    /// <summary>Gets the definition-selected background, or empty for transparent.</summary>
    public string BackgroundColor => Settings.BackgroundColor;

    /// <summary>Gets the encoded output format.</summary>
    public SurveySignatureFormat Format => Settings.Format;

    /// <summary>Gets the authored canvas width.</summary>
    public int Width => Settings.Width;

    /// <summary>Gets the authored canvas height.</summary>
    public int Height => Settings.Height;

    /// <summary>Gets the stored signature, or an empty string when unsigned.</summary>
    public string Signature => Value.Kind == KajayValueKind.Text ? Value.GetString() : string.Empty;

    /// <summary>Stores a signature; an empty string clears it.</summary>
    public void Sign(string data)
    {
        ArgumentNullException.ThrowIfNull(data);
        SetValue(data.Length == 0 ? KajayValue.Absent : KajayValue.From(data));
    }
}
