using System.Text.Json.Nodes;

namespace Kajay;

/// <summary>Canonical input available to a host-defined question factory.</summary>
public sealed class SurveyQuestionFactoryContext
{
    private readonly SurveyRuntimeQuestion _definition;
    private readonly SurveyDefinitionRegistry _registry;

    internal SurveyQuestionFactoryContext(
        Survey survey,
        SurveyRuntimeQuestion definition,
        SurveyDefinitionRegistry registry)
    {
        Survey = survey;
        _definition = definition;
        _registry = registry;
    }

    /// <summary>Gets the mutable survey that will own the question.</summary>
    public Survey Survey { get; }

    /// <summary>Gets the exact registered question type.</summary>
    public string Type => _definition.Type;

    /// <summary>Gets the exact authored question name.</summary>
    public string Name => _definition.Name;

    /// <summary>Gets the response key after applying <c>valueName</c>.</summary>
    public string ValueName => _definition.ValueKey;

    /// <summary>Gets a detached copy of one canonical authored property.</summary>
    /// <param name="name">The exact JSON property name.</param>
    /// <returns>The property value, or null when absent or explicitly null.</returns>
    public JsonNode? GetProperty(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        if (_definition.Properties.TryGetPropertyValue(name, out JsonNode? value))
        {
            return value?.DeepClone();
        }

        DefinitionPropertyDescriptor? property = _registry.Metadata
            .GetProperties(Type)
            .FirstOrDefault(candidate => string.Equals(
                candidate.Name,
                name,
                StringComparison.Ordinal));
        return property?.DefaultValue?.DeepClone();
    }

    /// <summary>Gets one string property resolved for the survey's current locale.</summary>
    /// <param name="name">The exact JSON property name.</param>
    /// <returns>Plain or localized text, or an empty string for another value kind.</returns>
    public string GetTextProperty(string name)
    {
        JsonNode? value = GetProperty(name);
        return value is JsonValue scalar && scalar.TryGetValue(out string? text)
            ? text
            : value is JsonObject
                ? SurveyLocalizedText.From(value).Resolve(Survey.Locale)
                : string.Empty;
    }

    internal SurveyRuntimeQuestion Definition => _definition;
}
