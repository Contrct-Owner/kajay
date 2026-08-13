using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Definitions;

internal static class DefinitionReader
{
    private const string SchemaVersionProperty = "schemaVersion";
    private const string TypeProperty = "type";

    internal static JsonObject Read(
        JsonObject input,
        DefinitionRegistry registry,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        DefinitionSyntax.ValidateSchemaVersion(input, SchemaVersionProperty);
        JsonObject canonical = ReadElement(
            input,
            "survey",
            "survey",
            string.Empty,
            registry,
            diagnostics,
            [SchemaVersionProperty]);
        canonical.Insert(0, SchemaVersionProperty, KajayContracts.CurrentSurveySchemaVersion);
        return canonical;
    }

    private static JsonObject ReadElement(
        JsonObject input,
        string className,
        string impliedType,
        string path,
        DefinitionRegistry registry,
        ICollection<DefinitionDiagnostic> diagnostics,
        IReadOnlyCollection<string> reservedProperties)
    {
        IReadOnlyList<DefinitionPropertyDescriptor> properties = registry.GetProperties(className);
        IReadOnlyList<DefinitionChildCollectionDescriptor> childCollections =
            registry.GetChildCollections(className);
        var values = new Dictionary<string, JsonNode?>(StringComparer.Ordinal);
        var unknown = new JsonObject();
        var handled = new HashSet<string>(reservedProperties, StringComparer.Ordinal)
        {
            TypeProperty,
        };
        handled.UnionWith(childCollections.Select(collection => collection.Property));

        ReadProperties(input, className, path, properties, handled, values, unknown, diagnostics);
        JsonObject output = WriteProperties(className, impliedType, properties, values);
        foreach (DefinitionChildCollectionDescriptor collection in childCollections)
        {
            ReadChildren(input, output, collection, className, path, registry, diagnostics);
        }
        foreach ((string propertyName, JsonNode? value) in unknown)
        {
            output[propertyName] = value?.DeepClone();
        }

        BlankDiagnostics.Validate(className, output, registry, diagnostics);
        return output;
    }

    private static void ReadProperties(
        JsonObject input,
        string className,
        string path,
        IReadOnlyList<DefinitionPropertyDescriptor> properties,
        HashSet<string> handled,
        Dictionary<string, JsonNode?> values,
        JsonObject unknown,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        foreach ((string propertyName, JsonNode? value) in input)
        {
            if (handled.Contains(propertyName))
            {
                continue;
            }

            DefinitionPropertyDescriptor? descriptor = properties.FirstOrDefault(
                candidate => string.Equals(candidate.Name, propertyName, StringComparison.Ordinal));
            if (descriptor is null)
            {
                unknown[propertyName] = value?.DeepClone();
                diagnostics.Add(new DefinitionDiagnostic(
                    "unknown-property",
                    $"{path}/{DefinitionSyntax.EscapePointerSegment(propertyName)}",
                    DiagnosticSeverity.Warning));
                continue;
            }

            if (!DefinitionValueReader.MatchesPropertyType(value, descriptor))
            {
                diagnostics.Add(new DefinitionDiagnostic(
                    "property-type-mismatch",
                    $"{path}/{DefinitionSyntax.EscapePointerSegment(propertyName)}",
                    DiagnosticSeverity.Error));
                continue;
            }

            ValidatePattern(className, propertyName, value, path, diagnostics);
            ValidateReservedName(propertyName, value, path, diagnostics);
            values[propertyName] = value?.DeepClone();
        }
    }

    private static JsonObject WriteProperties(
        string className,
        string impliedType,
        IReadOnlyList<DefinitionPropertyDescriptor> properties,
        Dictionary<string, JsonNode?> values)
    {
        var output = new JsonObject();
        if (!string.Equals(className, impliedType, StringComparison.Ordinal))
        {
            output[TypeProperty] = className;
        }

        foreach (DefinitionPropertyDescriptor descriptor in properties)
        {
            if (!values.TryGetValue(descriptor.Name, out JsonNode? value))
            {
                if (descriptor.IsRequired)
                {
                    output[descriptor.Name] = descriptor.DefaultValue?.DeepClone();
                }

                continue;
            }

            if (descriptor.IsRequired || !JsonNode.DeepEquals(value, descriptor.DefaultValue))
            {
                output[descriptor.Name] = value?.DeepClone();
            }
        }

        return output;
    }

    private static void ValidatePattern(
        string className,
        string propertyName,
        JsonNode? value,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (string.Equals(className, "regexvalidator", StringComparison.Ordinal)
            && string.Equals(propertyName, "regex", StringComparison.Ordinal)
            && value is JsonValue patternValue
            && patternValue.TryGetValue(out string? pattern)
            && !KajayPatternSyntax.IsValid(pattern))
        {
            diagnostics.Add(new DefinitionDiagnostic(
                "invalid-pattern",
                $"{path}/{propertyName}",
                DiagnosticSeverity.Error));
        }
    }

    /// <summary>Reports an element named into the host-value scope.</summary>
    /// <remarks>
    /// At error severity, because the name does not merely collide: resolution tests the sigil
    /// before it consults the answers, so an element named <c>$tier</c> is unreachable from every
    /// expression in the survey. The authored name is kept rather than rewritten, because a
    /// definition round-trips as authored and renaming an element would break every response
    /// already recorded against it.
    /// </remarks>
    private static void ValidateReservedName(
        string propertyName,
        JsonNode? value,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (string.Equals(propertyName, "name", StringComparison.Ordinal)
            && value is JsonValue nameValue
            && nameValue.TryGetValue(out string? name)
            && HostValueScope.IsHostValueName(name))
        {
            diagnostics.Add(new DefinitionDiagnostic(
                "reserved-name-sigil",
                $"{path}/{propertyName}",
                DiagnosticSeverity.Error));
        }
    }

    private static void ReadChildren(
        JsonObject input,
        JsonObject output,
        DefinitionChildCollectionDescriptor collection,
        string className,
        string path,
        DefinitionRegistry registry,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (!input.TryGetPropertyValue(collection.Property, out JsonNode? raw))
        {
            return;
        }

        string collectionPath =
            $"{path}/{DefinitionSyntax.EscapePointerSegment(collection.Property)}";
        if (raw is not JsonArray children)
        {
            diagnostics.Add(new DefinitionDiagnostic(
                "invalid-child-collection",
                collectionPath,
                DiagnosticSeverity.Error));
            return;
        }

        IReadOnlyList<string> allowedTypes = registry.GetConcreteSubclasses(
            collection.ElementBaseType);
        var canonical = new JsonArray();
        for (int index = 0; index < children.Count; index += 1)
        {
            string childPath = $"{collectionPath}/{index}";
            JsonObject? child = ReadChild(
                children[index], collection, allowedTypes, childPath, registry, diagnostics);
            if (child is not null)
            {
                canonical.Add((JsonNode?)child);
            }
        }

        if (canonical.Count > 0)
        {
            output[collection.Property] = canonical;
        }
    }

    private static JsonObject? ReadChild(
        JsonNode? raw,
        DefinitionChildCollectionDescriptor collection,
        IReadOnlyList<string> allowedTypes,
        string path,
        DefinitionRegistry registry,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        JsonObject? child = ExpandChild(raw, collection);
        if (child is null)
        {
            diagnostics.Add(new DefinitionDiagnostic(
                "invalid-element", path, DiagnosticSeverity.Error));
            return null;
        }

        string childType = child[TypeProperty] is JsonValue typeValue
            && typeValue.TryGetValue(out string? declaredType)
            ? declaredType
            : collection.ElementBaseType;
        if (!allowedTypes.Contains(childType, StringComparer.Ordinal))
        {
            diagnostics.Add(new DefinitionDiagnostic(
                "unknown-element-type", path, DiagnosticSeverity.Error));
            return null;
        }

        return ReadElement(
            child,
            childType,
            collection.ElementBaseType,
            path,
            registry,
            diagnostics,
            []);
    }

    private static JsonObject? ExpandChild(
        JsonNode? raw,
        DefinitionChildCollectionDescriptor collection)
    {
        if (raw is JsonObject child)
        {
            return child;
        }

        if (collection.ShorthandProperty is null
            || raw is not JsonValue value
            || value.GetValueKind() is not (
                JsonValueKind.String
                or JsonValueKind.Number
                or JsonValueKind.True
                or JsonValueKind.False))
        {
            return null;
        }

        return new JsonObject
        {
            [collection.ShorthandProperty] = raw.DeepClone(),
        };
    }

}
