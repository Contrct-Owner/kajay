namespace Kajay.Extensibility;

/// <summary>An immutable metadata and native-question extension registry.</summary>
public sealed class SurveyDefinitionRegistry
{
    private readonly IReadOnlyDictionary<string, SurveyQuestionFactory> _questionFactories;

    private SurveyDefinitionRegistry(
        DefinitionRegistry metadata,
        IReadOnlyDictionary<string, SurveyQuestionFactory> questionFactories)
    {
        Metadata = metadata;
        _questionFactories = questionFactories;
    }

    /// <summary>Gets the embedded Kajay metadata without host extensions.</summary>
    public static SurveyDefinitionRegistry Default { get; } = new(
        DefinitionRegistry.Default,
        new Dictionary<string, SurveyQuestionFactory>(StringComparer.Ordinal));

    /// <summary>Returns a new registry containing one additional class.</summary>
    /// <param name="registration">The class metadata and optional question factory.</param>
    /// <returns>An independent registry; this instance remains unchanged.</returns>
    public SurveyDefinitionRegistry WithClass(SurveyDefinitionClassRegistration registration)
    {
        ArgumentNullException.ThrowIfNull(registration);
        DefinitionRegistry metadata = Metadata.AddClass(ToDescriptor(registration));
        var factories = new Dictionary<string, SurveyQuestionFactory>(
            _questionFactories,
            StringComparer.Ordinal);
        if (registration.QuestionFactory is not null)
        {
            if (registration.IsAbstract || !metadata.IsSubclassOf(registration.Name, "question"))
            {
                throw new ArgumentException(
                    "A question factory may be attached only to a concrete question subclass.",
                    nameof(registration));
            }

            factories.Add(registration.Name, registration.QuestionFactory);
        }

        return new SurveyDefinitionRegistry(metadata, factories);
    }

    /// <summary>Returns a new registry adding one property to an existing class.</summary>
    public SurveyDefinitionRegistry WithProperty(
        string className,
        SurveyDefinitionPropertyRegistration property)
    {
        ArgumentException.ThrowIfNullOrEmpty(className);
        ArgumentNullException.ThrowIfNull(property);
        return new SurveyDefinitionRegistry(
            Metadata.AddProperty(className, ToDescriptor(property)),
            _questionFactories);
    }

    internal DefinitionRegistry Metadata { get; }

    internal bool TryGetQuestionFactory(string type, out SurveyQuestionFactory factory)
    {
        return _questionFactories.TryGetValue(type, out factory!);
    }

    private static DefinitionClassDescriptor ToDescriptor(
        SurveyDefinitionClassRegistration registration)
    {
        DefinitionPropertyDescriptor[] properties = registration.Properties
            .Select(ToDescriptor)
            .ToArray();
        DefinitionChildCollectionDescriptor[] collections = registration.ChildCollections
            .Select(collection => new DefinitionChildCollectionDescriptor(
                collection.Property,
                collection.ElementBaseType,
                collection.ShorthandProperty))
            .ToArray();
        return new DefinitionClassDescriptor(
            registration.Name,
            registration.Parent,
            registration.IsAbstract,
            Array.AsReadOnly(properties),
            Array.AsReadOnly(collections));
    }

    private static DefinitionPropertyDescriptor ToDescriptor(
        SurveyDefinitionPropertyRegistration property)
    {
        return new DefinitionPropertyDescriptor(
            property.Name,
            property.Type switch
            {
                SurveyDefinitionPropertyType.Text => DefinitionPropertyType.String,
                SurveyDefinitionPropertyType.Number => DefinitionPropertyType.Number,
                SurveyDefinitionPropertyType.Boolean => DefinitionPropertyType.Boolean,
                SurveyDefinitionPropertyType.Scalar => DefinitionPropertyType.Value,
                SurveyDefinitionPropertyType.Json => DefinitionPropertyType.Json,
                _ => throw new ArgumentOutOfRangeException(nameof(property)),
            },
            property.CopyDefaultValue(),
            property.IsRequired,
            property.IsLocalizable);
    }
}
