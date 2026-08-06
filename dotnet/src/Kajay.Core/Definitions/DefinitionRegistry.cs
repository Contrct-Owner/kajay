using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Definitions;

internal sealed class DefinitionRegistry
{
    private readonly IReadOnlyDictionary<string, DefinitionClassDescriptor> _classes;

    private DefinitionRegistry(IReadOnlyDictionary<string, DefinitionClassDescriptor> classes)
    {
        _classes = classes;
    }

    internal static DefinitionRegistry Default { get; } = ReadEmbeddedMetadata();

    internal DefinitionClassDescriptor GetClass(string name)
    {
        return _classes.TryGetValue(name, out DefinitionClassDescriptor? descriptor)
            ? descriptor
            : throw new InvalidOperationException(
                $"Embedded runtime metadata does not declare class '{name}'.");
    }

    internal IReadOnlyList<DefinitionPropertyDescriptor> GetProperties(string className)
    {
        DefinitionClassDescriptor descriptor = GetClass(className);
        List<DefinitionPropertyDescriptor> properties = descriptor.Parent is null
            ? []
            : new List<DefinitionPropertyDescriptor>(GetProperties(descriptor.Parent));

        foreach (DefinitionPropertyDescriptor property in descriptor.DeclaredProperties)
        {
            int inheritedIndex = properties.FindIndex(
                inherited => string.Equals(
                    inherited.Name,
                    property.Name,
                    StringComparison.Ordinal));
            if (inheritedIndex < 0)
            {
                properties.Add(property);
            }
            else
            {
                properties[inheritedIndex] = property;
            }
        }

        return properties;
    }

    internal IReadOnlyList<DefinitionChildCollectionDescriptor> GetChildCollections(
        string className)
    {
        DefinitionClassDescriptor descriptor = GetClass(className);
        List<DefinitionChildCollectionDescriptor> collections = descriptor.Parent is null
            ? []
            : new List<DefinitionChildCollectionDescriptor>(
                GetChildCollections(descriptor.Parent));
        collections.AddRange(descriptor.DeclaredChildCollections);
        return collections;
    }

    internal IReadOnlyList<string> GetConcreteSubclasses(string baseClassName)
    {
        return _classes.Values
            .Where(descriptor => !descriptor.IsAbstract && IsSubclassOf(descriptor.Name, baseClassName))
            .Select(descriptor => descriptor.Name)
            .Order(StringComparer.Ordinal)
            .ToArray();
    }

    internal bool IsSubclassOf(string className, string ancestorName)
    {
        string? current = className;
        while (current is not null)
        {
            if (string.Equals(current, ancestorName, StringComparison.Ordinal))
            {
                return true;
            }

            current = GetClass(current).Parent;
        }

        return false;
    }

    internal DefinitionRegistry AddClass(DefinitionClassDescriptor descriptor)
    {
        if (_classes.ContainsKey(descriptor.Name))
        {
            throw new ArgumentException(
                $"Class '{descriptor.Name}' is already registered.",
                nameof(descriptor));
        }
        if (descriptor.Parent is not null && !_classes.ContainsKey(descriptor.Parent))
        {
            throw new ArgumentException(
                $"Parent class '{descriptor.Parent}' is not registered.",
                nameof(descriptor));
        }
        foreach (DefinitionChildCollectionDescriptor collection in descriptor.DeclaredChildCollections)
        {
            if (!_classes.ContainsKey(collection.ElementBaseType))
            {
                throw new ArgumentException(
                    $"Child base class '{collection.ElementBaseType}' is not registered.",
                    nameof(descriptor));
            }
        }

        EnsureUniqueMembers(descriptor);
        var classes = new Dictionary<string, DefinitionClassDescriptor>(
            _classes,
            StringComparer.Ordinal)
        {
            [descriptor.Name] = descriptor,
        };
        return new DefinitionRegistry(classes);
    }

    internal DefinitionRegistry AddProperty(
        string className,
        DefinitionPropertyDescriptor property)
    {
        DefinitionClassDescriptor descriptor = GetClass(className);
        if (GetProperties(className).Any(existing => string.Equals(
            existing.Name,
            property.Name,
            StringComparison.Ordinal)))
        {
            throw new ArgumentException(
                $"Class '{className}' already declares property '{property.Name}'.",
                nameof(property));
        }

        DefinitionClassDescriptor replacement = descriptor with
        {
            DeclaredProperties = Array.AsReadOnly(
                descriptor.DeclaredProperties.Append(property).ToArray()),
        };
        var classes = new Dictionary<string, DefinitionClassDescriptor>(
            _classes,
            StringComparer.Ordinal)
        {
            [className] = replacement,
        };
        return new DefinitionRegistry(classes);
    }

    private static void EnsureUniqueMembers(DefinitionClassDescriptor descriptor)
    {
        if (descriptor.DeclaredProperties.Select(property => property.Name)
            .Distinct(StringComparer.Ordinal).Count() != descriptor.DeclaredProperties.Count)
        {
            throw new ArgumentException(
                $"Class '{descriptor.Name}' declares a property more than once.",
                nameof(descriptor));
        }
        if (descriptor.DeclaredChildCollections.Select(collection => collection.Property)
            .Distinct(StringComparer.Ordinal).Count() != descriptor.DeclaredChildCollections.Count)
        {
            throw new ArgumentException(
                $"Class '{descriptor.Name}' declares a child collection more than once.",
                nameof(descriptor));
        }
        if (descriptor.DeclaredProperties.Any(property => descriptor.DeclaredChildCollections
            .Any(collection => string.Equals(
                collection.Property,
                property.Name,
                StringComparison.Ordinal))))
        {
            throw new ArgumentException(
                $"Class '{descriptor.Name}' uses one name for a property and child collection.",
                nameof(descriptor));
        }
    }

    private static DefinitionRegistry ReadEmbeddedMetadata()
    {
        using Stream stream = KajayContracts.OpenRuntimeMetadata();
        using JsonDocument document = JsonDocument.Parse(stream);
        var classes = new Dictionary<string, DefinitionClassDescriptor>(StringComparer.Ordinal);

        foreach (JsonElement classElement in document.RootElement
                     .GetProperty("classes")
                     .EnumerateArray())
        {
            DefinitionClassDescriptor descriptor = ReadClass(classElement);
            if (!classes.TryAdd(descriptor.Name, descriptor))
            {
                throw new InvalidOperationException(
                    $"Embedded runtime metadata declares class '{descriptor.Name}' more than once.");
            }
        }

        return new DefinitionRegistry(classes);
    }

    private static DefinitionClassDescriptor ReadClass(JsonElement element)
    {
        string name = element.GetProperty("name").GetString()
            ?? throw new InvalidOperationException("Embedded class metadata has no name.");
        JsonElement parentElement = element.GetProperty("parent");
        string? parent = parentElement.ValueKind is JsonValueKind.Null
            ? null
            : parentElement.GetString();

        DefinitionPropertyDescriptor[] properties = element
            .GetProperty("declaredProperties")
            .EnumerateArray()
            .Select(ReadProperty)
            .ToArray();
        DefinitionChildCollectionDescriptor[] collections = element
            .GetProperty("declaredChildCollections")
            .EnumerateArray()
            .Select(ReadChildCollection)
            .ToArray();

        return new DefinitionClassDescriptor(
            name,
            parent,
            element.GetProperty("isAbstract").GetBoolean(),
            properties,
            collections);
    }

    private static DefinitionPropertyDescriptor ReadProperty(JsonElement element)
    {
        string typeName = element.GetProperty("type").GetString()
            ?? throw new InvalidOperationException("Embedded property metadata has no type.");
        DefinitionPropertyType type = typeName switch
        {
            "string" => DefinitionPropertyType.String,
            "number" => DefinitionPropertyType.Number,
            "boolean" => DefinitionPropertyType.Boolean,
            "value" => DefinitionPropertyType.Value,
            "json" => DefinitionPropertyType.Json,
            _ => throw new InvalidOperationException(
                $"Embedded property metadata declares unknown type '{typeName}'."),
        };

        return new DefinitionPropertyDescriptor(
            element.GetProperty("name").GetString()
                ?? throw new InvalidOperationException("Embedded property metadata has no name."),
            type,
            JsonNode.Parse(element.GetProperty("defaultValue").GetRawText()),
            element.GetProperty("isRequired").GetBoolean(),
            element.GetProperty("isLocalizable").GetBoolean());
    }

    private static DefinitionChildCollectionDescriptor ReadChildCollection(JsonElement element)
    {
        JsonElement shorthand = element.GetProperty("shorthandProperty");
        return new DefinitionChildCollectionDescriptor(
            element.GetProperty("property").GetString()
                ?? throw new InvalidOperationException("Embedded child metadata has no property."),
            element.GetProperty("elementBaseType").GetString()
                ?? throw new InvalidOperationException("Embedded child metadata has no base type."),
            shorthand.ValueKind is JsonValueKind.Null ? null : shorthand.GetString());
    }
}
