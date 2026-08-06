namespace Kajay;

/// <summary>Metadata for a host-defined collection of nested definition elements.</summary>
public sealed record SurveyDefinitionChildCollectionRegistration
{
    /// <summary>Initializes a child-collection registration.</summary>
    public SurveyDefinitionChildCollectionRegistration(
        string property,
        string elementBaseType,
        string? shorthandProperty = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(property);
        ArgumentException.ThrowIfNullOrEmpty(elementBaseType);
        if (shorthandProperty is not null)
        {
            ArgumentException.ThrowIfNullOrEmpty(shorthandProperty);
        }

        Property = property;
        ElementBaseType = elementBaseType;
        ShorthandProperty = shorthandProperty;
    }

    /// <summary>Gets the JSON array property.</summary>
    public string Property { get; }

    /// <summary>Gets the registered base type accepted by the array.</summary>
    public string ElementBaseType { get; }

    /// <summary>Gets the property receiving a scalar shorthand, when supported.</summary>
    public string? ShorthandProperty { get; }
}
