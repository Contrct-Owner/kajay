using System.Text.Json.Nodes;

namespace Kajay.Runtime;

/// <summary>A fill-in-the-blank question's prose and the blanks it positions.</summary>
/// <param name="Template">The authored prose, which may be one string or one per locale.</param>
/// <param name="Blanks">The questions each marker in the prose positions.</param>
/// <remarks>
/// The template positions and the collection declares — and what it declares is a real
/// question, as a matrix's cell columns and a dynamic panel's template elements already
/// are. A dropdown blank *is* a dropdown, so its choices and its marking arrive with it.
/// </remarks>
internal sealed record SurveyRuntimeBlankSettings(
    SurveyLocalizedText Template,
    IReadOnlyList<SurveyRuntimeQuestion> Blanks)
{
    internal static SurveyRuntimeBlankSettings? From(
        JsonObject element,
        SurveyDefinitionRegistry registry)
    {
        if (element["type"]?.GetValue<string>() != "fillintheblank")
        {
            return null;
        }

        return new SurveyRuntimeBlankSettings(
            SurveyLocalizedText.From(element["template"]),
            SurveyRuntimeQuestion.FromElements(element["blanks"] as JsonArray ?? [], registry));
    }
}
