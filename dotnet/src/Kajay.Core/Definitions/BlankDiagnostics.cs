using System.Text.Json.Nodes;

namespace Kajay.Definitions;

/// <summary>
/// Everything wrong between a fill-in-the-blank sentence and the blanks it names.
/// </summary>
/// <remarks>
/// Its own file because the reader was at the size limit and this is a self-contained
/// judgement over one finished element — the same split the TypeScript runtime makes.
/// </remarks>
internal static class BlankDiagnostics
{
    /// <summary>Reports what is wrong between a sentence and the blanks it names.</summary>
    /// <remarks>
    /// After the children are read, because every rule here compares the template against
    /// the collection beside it and neither is complete until both have been. Reported
    /// against the question rather than the property, matching the TypeScript runtime — a
    /// diagnostic the conformance corpus carries has to name the same place in both.
    /// </remarks>
    internal static void Validate(
        string className,
        JsonObject element,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (!string.Equals(className, "fillintheblank", StringComparison.Ordinal))
        {
            return;
        }

        string name = element["name"]?.GetValue<string>() ?? string.Empty;
        string path = $"/{name}";
        JsonNode? template = element["template"];
        string authored = TemplateFor(template);
        HashSet<string> positioned = BlankTemplate.NamesIn(authored).ToHashSet(StringComparer.Ordinal);
        HashSet<string> declared = (element["blanks"] as JsonArray ?? [])
            .OfType<JsonObject>()
            .Select(blank => blank["name"]?.GetValue<string>() ?? string.Empty)
            .ToHashSet(StringComparer.Ordinal);

        foreach (string missing in positioned.Where(candidate => !declared.Contains(candidate)))
        {
            diagnostics.Add(new DefinitionDiagnostic("undeclared-blank", path, DiagnosticSeverity.Error));
        }

        foreach (string unused in declared.Where(candidate => !positioned.Contains(candidate)))
        {
            diagnostics.Add(new DefinitionDiagnostic("unpositioned-blank", path, DiagnosticSeverity.Warning));
        }

        ValidateTranslations(template, positioned, path, diagnostics);
    }

    /// <summary>Reports a translation that names a different set of blanks.</summary>
    /// <remarks>
    /// A translation may <em>move</em> a marker — word order differs between languages, and
    /// that is why the template is one translatable string. Renaming, dropping or inventing
    /// one would make the answer keys depend on the language the respondent read.
    /// </remarks>
    private static void ValidateTranslations(
        JsonNode? template,
        HashSet<string> positioned,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (template is not JsonObject localized)
        {
            return;
        }

        foreach ((string locale, JsonNode? text) in localized)
        {
            if (string.Equals(locale, "default", StringComparison.Ordinal))
            {
                continue;
            }

            HashSet<string> translated = BlankTemplate
                .NamesIn(text?.GetValue<string>() ?? string.Empty)
                .ToHashSet(StringComparer.Ordinal);
            if (!translated.SetEquals(positioned))
            {
                diagnostics.Add(new DefinitionDiagnostic(
                    "locale-blank-mismatch",
                    path,
                    DiagnosticSeverity.Error));
            }
        }
    }

    /// <summary>The default wording, which every translation is measured against.</summary>
    private static string TemplateFor(JsonNode? template)
    {
        if (template is JsonValue value && value.TryGetValue(out string? text))
        {
            return text;
        }

        return template is JsonObject localized
            ? localized["default"]?.GetValue<string>() ?? string.Empty
            : string.Empty;
    }
}
