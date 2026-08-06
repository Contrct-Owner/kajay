using System.Text.Json.Nodes;

namespace Kajay.Extensibility;

/// <summary>Metadata for one host-defined survey property.</summary>
public sealed class SurveyDefinitionPropertyRegistration
{
    private readonly JsonNode? _defaultValue;

    /// <summary>Initializes a property registration.</summary>
    public SurveyDefinitionPropertyRegistration(
        string name,
        SurveyDefinitionPropertyType type,
        bool isRequired = false,
        bool isLocalizable = false)
        : this(name, type, DefaultFor(type), isRequired, isLocalizable)
    {
    }

    /// <summary>Initializes a property registration with an explicit JSON default.</summary>
    public SurveyDefinitionPropertyRegistration(
        string name,
        SurveyDefinitionPropertyType type,
        JsonNode? defaultValue,
        bool isRequired = false,
        bool isLocalizable = false)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        if (isLocalizable && type != SurveyDefinitionPropertyType.Text)
        {
            throw new ArgumentException(
                "Only a text property may be localizable.",
                nameof(isLocalizable));
        }
        if (!Matches(type, defaultValue))
        {
            throw new ArgumentException(
                "The default value does not match the registered property type.",
                nameof(defaultValue));
        }

        Name = name;
        Type = type;
        _defaultValue = defaultValue?.DeepClone();
        IsRequired = isRequired;
        IsLocalizable = isLocalizable;
    }

    /// <summary>Gets the exact JSON property name.</summary>
    public string Name { get; }

    /// <summary>Gets the accepted JSON value kind.</summary>
    public SurveyDefinitionPropertyType Type { get; }

    /// <summary>Gets a detached copy of the canonical default value.</summary>
    public JsonNode? DefaultValue => _defaultValue?.DeepClone();

    /// <summary>Gets whether canonical JSON always emits this property.</summary>
    public bool IsRequired { get; }

    /// <summary>Gets whether a string may instead be an object keyed by locale.</summary>
    public bool IsLocalizable { get; }

    internal JsonNode? CopyDefaultValue()
    {
        return _defaultValue?.DeepClone();
    }

    private static JsonValue DefaultFor(SurveyDefinitionPropertyType type)
    {
        return type switch
        {
            SurveyDefinitionPropertyType.Number => JsonValue.Create(0),
            SurveyDefinitionPropertyType.Boolean => JsonValue.Create(false),
            _ => JsonValue.Create(string.Empty),
        };
    }

    private static bool Matches(SurveyDefinitionPropertyType type, JsonNode? value)
    {
        if (type == SurveyDefinitionPropertyType.Json)
        {
            return true;
        }
        if (value is not JsonValue scalar)
        {
            return false;
        }

        System.Text.Json.JsonValueKind kind = scalar.GetValueKind();
        return type switch
        {
            SurveyDefinitionPropertyType.Text => kind == System.Text.Json.JsonValueKind.String,
            SurveyDefinitionPropertyType.Number => kind == System.Text.Json.JsonValueKind.Number
                && scalar.TryGetValue(out double number)
                && double.IsFinite(number),
            SurveyDefinitionPropertyType.Boolean => kind is System.Text.Json.JsonValueKind.True
                or System.Text.Json.JsonValueKind.False,
            SurveyDefinitionPropertyType.Scalar => kind is System.Text.Json.JsonValueKind.String
                or System.Text.Json.JsonValueKind.True
                or System.Text.Json.JsonValueKind.False
                || kind == System.Text.Json.JsonValueKind.Number
                && scalar.TryGetValue(out double number)
                && double.IsFinite(number),
            _ => false,
        };
    }
}
