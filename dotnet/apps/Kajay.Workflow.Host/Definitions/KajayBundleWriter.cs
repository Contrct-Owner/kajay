using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Definitions;

internal static class KajayBundleWriter
{
    private static readonly DateTimeOffset EntryTimestamp =
        new(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);

    internal static byte[] Write(DefinitionReleaseContent content)
    {
        ArgumentNullException.ThrowIfNull(content);
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteEntry(archive, "manifest.json", WriteManifest(content));
            WriteEntry(archive, "workflow.json", content.Workflow.ToCanonicalJson());
            foreach ((string digest, string definition) in content.SurveyDefinitions
                .OrderBy(pair => pair.Key, StringComparer.Ordinal))
            {
                WriteEntry(archive, $"surveys/{digest[7..]}.json", definition);
            }
        }
        return output.ToArray();
    }

    private static string WriteManifest(DefinitionReleaseContent content)
    {
        var manifest = new JsonObject
        {
            ["formatVersion"] = 1,
            ["managedDefinitionName"] = content.ManagedDefinitionName,
            ["versionLabel"] = content.VersionLabel,
            ["conformanceVersion"] = content.ConformanceVersion,
            ["workflowPath"] = "workflow.json",
            ["surveys"] = new JsonArray(content.SurveyDefinitions.Keys
                .Order(StringComparer.Ordinal)
                .Select(digest => (JsonNode?)new JsonObject
                {
                    ["digest"] = digest,
                    ["path"] = $"surveys/{digest[7..]}.json",
                }).ToArray()),
            ["requiredBindings"] = new JsonArray(content.RequiredBindings
                .Order(StringComparer.Ordinal)
                .Select(binding => (JsonNode?)binding).ToArray()),
        };
        return manifest.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }

    private static void WriteEntry(ZipArchive archive, string name, string content)
    {
        ZipArchiveEntry entry = archive.CreateEntry(name, CompressionLevel.SmallestSize);
        entry.LastWriteTime = EntryTimestamp;
        using Stream stream = entry.Open();
        using var writer = new StreamWriter(
            stream,
            new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            leaveOpen: false);
        writer.Write(content);
    }
}
