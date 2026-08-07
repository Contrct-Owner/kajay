using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay.Workflow.Host.Contracts;

namespace Kajay.Workflow.Host.Definitions;

internal static class DefinitionReleaseDiffer
{
    private const int MaximumChanges = 200;
    private const int MaximumValueLength = 160;

    internal static DefinitionReleaseDifference Compare(JsonNode baseline, JsonNode target)
    {
        var changes = new List<DefinitionReleaseChangeResult>();
        AddNode(changes, baseline, true, target, true, "$", "release");
        return new DefinitionReleaseDifference(
            changes.Take(MaximumChanges).ToArray(), changes.Count > MaximumChanges);
    }

    private static void AddNode(
        List<DefinitionReleaseChangeResult> changes,
        JsonNode? before,
        bool hasBefore,
        JsonNode? after,
        bool hasAfter,
        string path,
        string area)
    {
        if (changes.Count > MaximumChanges || Equal(before, hasBefore, after, hasAfter)) return;
        if (!hasBefore || !hasAfter || before is null || after is null
            || before is JsonValue || after is JsonValue
            || before.GetType() != after.GetType())
        {
            AddChange(changes, before, hasBefore, after, hasAfter, path, area);
            return;
        }
        if (before is JsonObject beforeObject && after is JsonObject afterObject)
        {
            AddObject(changes, beforeObject, afterObject, path, area);
            return;
        }
        AddArray(changes, (JsonArray)before, (JsonArray)after, path, area);
    }

    private static void AddObject(
        List<DefinitionReleaseChangeResult> changes,
        JsonObject before,
        JsonObject after,
        string path,
        string area)
    {
        foreach (string property in before.Select(item => item.Key)
            .Union(after.Select(item => item.Key), StringComparer.Ordinal)
            .Order(StringComparer.Ordinal))
        {
            bool hasBefore = before.TryGetPropertyValue(property, out JsonNode? beforeValue);
            bool hasAfter = after.TryGetPropertyValue(property, out JsonNode? afterValue);
            AddNode(changes, beforeValue, hasBefore, afterValue, hasAfter,
                $"{path}.{property}", ReadArea(area, property));
        }
    }

    private static void AddArray(
        List<DefinitionReleaseChangeResult> changes,
        JsonArray before,
        JsonArray after,
        string path,
        string area)
    {
        string? identity = FindIdentity(before, after);
        if (identity is not null)
        {
            AddNamedArray(changes, before, after, path, area, identity);
            return;
        }
        for (int index = 0; index < Math.Max(before.Count, after.Count); index++)
        {
            AddNode(changes, index < before.Count ? before[index] : null, index < before.Count,
                index < after.Count ? after[index] : null, index < after.Count,
                $"{path}[{index}]", area);
        }
    }

    private static void AddNamedArray(
        List<DefinitionReleaseChangeResult> changes,
        JsonArray before,
        JsonArray after,
        string path,
        string area,
        string identity)
    {
        Dictionary<string, JsonNode?> beforeItems = ToNamedMap(before, identity);
        Dictionary<string, JsonNode?> afterItems = ToNamedMap(after, identity);
        foreach (string name in beforeItems.Keys.Union(afterItems.Keys, StringComparer.Ordinal)
            .Order(StringComparer.Ordinal))
        {
            AddNode(changes, beforeItems.GetValueOrDefault(name), beforeItems.ContainsKey(name),
                afterItems.GetValueOrDefault(name), afterItems.ContainsKey(name),
                $"{path}[{identity}={JsonSerializer.Serialize(name)}]", area);
        }
    }

    private static string? FindIdentity(JsonArray before, JsonArray after) =>
        IsNamed(before, after, "name") ? "name" : IsNamed(before, after, "key") ? "key" : null;

    private static bool IsNamed(JsonArray before, JsonArray after, string property)
    {
        return before.Count + after.Count != 0
            && HasUniqueNames(before, property)
            && HasUniqueNames(after, property);
    }

    private static bool HasUniqueNames(JsonArray values, string property)
    {
        string[] names = values.Select(
                item => (item as JsonObject)?[property]?.GetValue<string>())
            .OfType<string>().ToArray();
        return names.Length == values.Count
            && names.Distinct(StringComparer.Ordinal).Count() == names.Length;
    }

    private static Dictionary<string, JsonNode?> ToNamedMap(JsonArray values, string property) =>
        values.OfType<JsonObject>().ToDictionary(
            item => item[property]!.GetValue<string>(), item => (JsonNode?)item,
            StringComparer.Ordinal);

    private static bool Equal(JsonNode? before, bool hasBefore, JsonNode? after, bool hasAfter) =>
        hasBefore == hasAfter && (!hasBefore || JsonNode.DeepEquals(before, after));

    private static void AddChange(
        List<DefinitionReleaseChangeResult> changes,
        JsonNode? before,
        bool hasBefore,
        JsonNode? after,
        bool hasAfter,
        string path,
        string area) =>
        changes.Add(new DefinitionReleaseChangeResult(
            !hasBefore ? "added" : !hasAfter ? "removed" : "changed",
            area,
            path,
            hasBefore ? Format(before) : null,
            hasAfter ? Format(after) : null));

    private static string ReadArea(string current, string property) =>
        property == "definition" ? "definition"
            : current != "release" ? current
            : property == "workflow" ? "workflow"
            : property == "requiredBindings" ? "bindings"
            : "compatibility";

    private static string Format(JsonNode? value)
    {
        string text = value switch
        {
            null => "null",
            JsonObject => "{…}",
            JsonArray array => $"[{array.Count} items]",
            _ => value.ToJsonString(),
        };
        return text.Length <= MaximumValueLength ? text : $"{text[..MaximumValueLength]}…";
    }
}
