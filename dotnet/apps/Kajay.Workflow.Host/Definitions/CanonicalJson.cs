using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Definitions;

internal static class CanonicalJson
{
    internal static string Stringify(JsonNode node)
    {
        return Sort(node).ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }

    internal static JsonNode Sort(JsonNode node)
    {
        return node switch
        {
            JsonObject map => new JsonObject(map
                .OrderBy(pair => pair.Key, StringComparer.Ordinal)
                .Select(pair => KeyValuePair.Create(
                    pair.Key,
                    pair.Value is null ? null : Sort(pair.Value)))),
            JsonArray array => new JsonArray(array
                .Select(value => value is null ? null : Sort(value)).ToArray()),
            _ => node.DeepClone(),
        };
    }
}
