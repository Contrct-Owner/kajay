namespace Kajay;

/// <summary>One host-defined class in the survey metadata graph.</summary>
public sealed class SurveyDefinitionClassRegistration
{
    /// <summary>Initializes a class registration.</summary>
    public SurveyDefinitionClassRegistration(
        string name,
        string? parent = null,
        bool isAbstract = false,
        IEnumerable<SurveyDefinitionPropertyRegistration>? properties = null,
        IEnumerable<SurveyDefinitionChildCollectionRegistration>? childCollections = null,
        SurveyQuestionFactory? questionFactory = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        if (parent is not null)
        {
            ArgumentException.ThrowIfNullOrEmpty(parent);
        }

        Name = name;
        Parent = parent;
        IsAbstract = isAbstract;
        SurveyDefinitionPropertyRegistration[] copiedProperties = (properties ?? []).ToArray();
        SurveyDefinitionChildCollectionRegistration[] copiedCollections =
            (childCollections ?? []).ToArray();
        if (copiedProperties.Any(property => property is null))
        {
            throw new ArgumentException("Properties cannot contain null.", nameof(properties));
        }
        if (copiedCollections.Any(collection => collection is null))
        {
            throw new ArgumentException(
                "Child collections cannot contain null.",
                nameof(childCollections));
        }

        Properties = Array.AsReadOnly(copiedProperties);
        ChildCollections = Array.AsReadOnly(copiedCollections);
        QuestionFactory = questionFactory;
    }

    /// <summary>Gets the exact registered type name.</summary>
    public string Name { get; }

    /// <summary>Gets the already-registered parent type, if any.</summary>
    public string? Parent { get; }

    /// <summary>Gets whether the class contributes metadata but cannot appear in JSON.</summary>
    public bool IsAbstract { get; }

    /// <summary>Gets properties declared directly by this class.</summary>
    public IReadOnlyList<SurveyDefinitionPropertyRegistration> Properties { get; }

    /// <summary>Gets child collections declared directly by this class.</summary>
    public IReadOnlyList<SurveyDefinitionChildCollectionRegistration> ChildCollections { get; }

    /// <summary>Gets the native runtime factory for a concrete question type.</summary>
    public SurveyQuestionFactory? QuestionFactory { get; }
}
