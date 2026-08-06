using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay;

internal static class DefinitionReader
{
    private const string SchemaVersionProperty = "schemaVersion";
    private const string TypeProperty = "type";

    internal static JsonObject Read(
        JsonObject input,
        DefinitionRegistry registry,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        ValidateSchemaVersion(input);
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

        foreach ((string propertyName, JsonNode? value) in input)
        {
            if (handled.Contains(propertyName))
            {
                continue;
            }

            DefinitionPropertyDescriptor? descriptor = properties.FirstOrDefault(
                candidate => string.Equals(
                    candidate.Name,
                    propertyName,
                    StringComparison.Ordinal));
            if (descriptor is null)
            {
                unknown[propertyName] = value?.DeepClone();
                diagnostics.Add(new DefinitionDiagnostic(
                    "unknown-property",
                    $"{path}/{EscapePointerSegment(propertyName)}",
                    DiagnosticSeverity.Warning));
                continue;
            }

            if (!MatchesPropertyType(value, descriptor))
            {
                diagnostics.Add(new DefinitionDiagnostic(
                    "property-type-mismatch",
                    $"{path}/{EscapePointerSegment(propertyName)}",
                    DiagnosticSeverity.Error));
                continue;
            }

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

            values[propertyName] = value?.DeepClone();
        }

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

        foreach (DefinitionChildCollectionDescriptor collection in childCollections)
        {
            ReadChildren(input, output, collection, className, path, registry, diagnostics);
        }

        foreach ((string propertyName, JsonNode? value) in unknown)
        {
            output[propertyName] = value?.DeepClone();
        }

        return output;
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

        string collectionPath = $"{path}/{EscapePointerSegment(collection.Property)}";
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
            JsonObject? child = ExpandChild(children[index], collection);
            if (child is null)
            {
                diagnostics.Add(new DefinitionDiagnostic(
                    "invalid-element",
                    childPath,
                    DiagnosticSeverity.Error));
                continue;
            }

            string childType = child[TypeProperty] is JsonValue typeValue
                && typeValue.TryGetValue(out string? declaredType)
                ? declaredType
                : collection.ElementBaseType;
            if (!allowedTypes.Contains(childType, StringComparer.Ordinal))
            {
                diagnostics.Add(new DefinitionDiagnostic(
                    "unknown-element-type",
                    childPath,
                    DiagnosticSeverity.Error));
                continue;
            }

            canonical.Add((JsonNode?)ReadElement(
                child,
                childType,
                collection.ElementBaseType,
                childPath,
                registry,
                diagnostics,
                []));
        }

        if (canonical.Count > 0)
        {
            output[collection.Property] = canonical;
        }
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

    private static bool MatchesPropertyType(
        JsonNode? value,
        DefinitionPropertyDescriptor descriptor)
    {
        if (descriptor.IsLocalizable && IsLocalizedText(value))
        {
            return true;
        }

        if (descriptor.Type is DefinitionPropertyType.Json)
        {
            return true;
        }

        if (value is not JsonValue jsonValue)
        {
            return false;
        }

        JsonValueKind kind = jsonValue.GetValueKind();
        return descriptor.Type switch
        {
            DefinitionPropertyType.String => kind is JsonValueKind.String,
            DefinitionPropertyType.Number => kind is JsonValueKind.Number
                && jsonValue.TryGetValue(out double number)
                && double.IsFinite(number),
            DefinitionPropertyType.Boolean => kind is JsonValueKind.True or JsonValueKind.False,
            DefinitionPropertyType.Value => kind is JsonValueKind.String
                or JsonValueKind.True
                or JsonValueKind.False
                || kind is JsonValueKind.Number
                && jsonValue.TryGetValue(out double scalarNumber)
                && double.IsFinite(scalarNumber),
            DefinitionPropertyType.Json => true,
            _ => false,
        };
    }

    private static bool IsLocalizedText(JsonNode? value)
    {
        return value is JsonObject localized
            && localized.All(entry => entry.Value is JsonValue item
                && item.GetValueKind() is JsonValueKind.String);
    }

    private static void ValidateSchemaVersion(JsonObject input)
    {
        if (!input.TryGetPropertyValue(SchemaVersionProperty, out JsonNode? value))
        {
            return;
        }

        if (value is not JsonValue jsonValue
            || !jsonValue.TryGetValue(out int declaredVersion))
        {
            throw new JsonException(
                $"'{SchemaVersionProperty}' must be an integer when present.");
        }

        if (!KajayContracts.SupportedSurveySchemaVersions.Contains(declaredVersion))
        {
            throw new UnsupportedSurveySchemaVersionException(declaredVersion);
        }
    }

    private static string EscapePointerSegment(string value)
    {
        return value.Replace("~", "~0", StringComparison.Ordinal)
            .Replace("/", "~1", StringComparison.Ordinal);
    }
}
