using System.Text.Json.Nodes;

namespace Kajay.Runtime;

/// <summary>One blank a fill-in-the-blank template positions.</summary>
/// <param name="Name">Key this blank is stored under inside the question answer.</param>
/// <param name="Label">What a screen reader calls it; falls back to the name.</param>
/// <param name="InputType">The HTML input type an adapter should draw.</param>
/// <param name="IsRequired">Whether an empty blank is an error.</param>
/// <param name="HasCorrectAnswer">Whether this blank is marked at all.</param>
/// <param name="CorrectAnswer">The answer that scores it.</param>
/// <param name="Trim">Whether surrounding whitespace is ignored when marking.</param>
/// <param name="CaseSensitive">Whether case matters when marking.</param>
internal sealed record SurveyRuntimeBlank(
    string Name,
    SurveyLocalizedText Label,
    string InputType,
    bool IsRequired,
    bool HasCorrectAnswer,
    KajayValue CorrectAnswer,
    bool Trim,
    bool CaseSensitive);

/// <summary>A fill-in-the-blank question's prose and the blanks it positions.</summary>
/// <param name="Template">The authored prose, which may be one string or one per locale.</param>
/// <param name="Blanks">What each marker in the prose means.</param>
/// <remarks>
/// The template positions and the collection declares. Correct answers and labels have
/// nowhere to live in a sentence a translator edits — and putting them there would mean a
/// translation could change the marking.
/// </remarks>
internal sealed record SurveyRuntimeBlankSettings(
    SurveyLocalizedText Template,
    IReadOnlyList<SurveyRuntimeBlank> Blanks)
{
    internal static SurveyRuntimeBlankSettings? From(JsonObject element)
    {
        if (element["type"]?.GetValue<string>() != "fillintheblank")
        {
            return null;
        }

        SurveyRuntimeBlank[] blanks = (element["blanks"] as JsonArray ?? [])
            .OfType<JsonObject>()
            .Select(ReadBlank)
            .ToArray();
        return new SurveyRuntimeBlankSettings(
            SurveyLocalizedText.From(element["template"]),
            Array.AsReadOnly(blanks));
    }

    private static SurveyRuntimeBlank ReadBlank(JsonObject blank)
    {
        JsonNode? correct = blank["correctAnswer"];
        return new SurveyRuntimeBlank(
            blank["name"]?.GetValue<string>() ?? string.Empty,
            SurveyLocalizedText.From(blank["label"]),
            blank["inputType"]?.GetValue<string>() ?? "text",
            blank["isRequired"]?.GetValue<bool>() ?? false,
            correct is not null,
            correct is null ? KajayValue.Absent : KajayJsonValue.From(correct),
            // Defaults live on the metadata descriptors, so an authored definition that
            // omits them arrives with them already applied; these mirror that for a
            // definition read straight from JSON.
            blank["trim"]?.GetValue<bool>() ?? true,
            blank["caseSensitive"]?.GetValue<bool>() ?? false);
    }
}
