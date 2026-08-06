using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Definitions;

internal static class KajayBundle
{
    private const int MaximumEntries = 100;
    private const int MaximumExpandedBytes = 10 * 1024 * 1024;
    internal static byte[] Write(DefinitionReleaseContent content)
    {
        return KajayBundleWriter.Write(content);
    }

    internal static DefinitionReleaseContent Read(ReadOnlyMemory<byte> bundle)
    {
        if (bundle.IsEmpty || bundle.Length > MaximumExpandedBytes)
        {
            throw new InvalidDataException("A .kajay bundle must contain 1 byte to 10 MiB.");
        }

        using var input = new MemoryStream(bundle.ToArray(), writable: false);
        using var archive = new ZipArchive(input, ZipArchiveMode.Read);
        if (archive.Entries.Count is 0 or > MaximumEntries)
        {
            throw new InvalidDataException("A .kajay bundle must contain 1 to 100 entries.");
        }

        Dictionary<string, string> entries = ReadEntries(archive);
        JsonObject manifest = ParseObject(ReadRequired(entries, "manifest.json"), "manifest");
        if (ReadInt(manifest, "formatVersion") != 1)
        {
            throw new InvalidDataException("Only .kajay bundle format version 1 is supported.");
        }

        string workflowPath = ReadString(manifest, "workflowPath");
        if (!string.Equals(workflowPath, "workflow.json", StringComparison.Ordinal))
        {
            throw new InvalidDataException("The workflow path must be 'workflow.json'.");
        }
        WorkflowDefinition workflow = WorkflowDefinition.Parse(ReadRequired(entries, workflowPath));
        Dictionary<string, string> surveys = ReadSurveys(manifest, entries);
        ValidateClosure(workflow, surveys);
        EnsureNoUnexpectedEntries(entries, surveys.Keys);
        return new DefinitionReleaseContent
        {
            ManagedDefinitionName = ReadName(manifest, "managedDefinitionName"),
            VersionLabel = ReadName(manifest, "versionLabel"),
            ConformanceVersion = ReadPositiveInt(manifest, "conformanceVersion"),
            Workflow = workflow,
            SurveyDefinitions = surveys,
            RequiredBindings = ReadBindings(manifest),
        };
    }

    private static Dictionary<string, string> ReadEntries(ZipArchive archive)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        int expandedBytes = 0;
        foreach (ZipArchiveEntry entry in archive.Entries)
        {
            ValidateEntryName(entry.FullName);
            if (entry.Length > MaximumExpandedBytes
                || expandedBytes > MaximumExpandedBytes - entry.Length)
            {
                throw new InvalidDataException("The expanded .kajay bundle exceeds 10 MiB.");
            }
            expandedBytes += checked((int)entry.Length);
            using Stream stream = entry.Open();
            using var reader = new StreamReader(
                stream,
                new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true),
                detectEncodingFromByteOrderMarks: false,
                leaveOpen: false);
            string value = reader.ReadToEnd();
            if (!result.TryAdd(entry.FullName, value))
            {
                throw new InvalidDataException($"Duplicate bundle entry '{entry.FullName}'.");
            }
        }
        return result;
    }

    private static Dictionary<string, string> ReadSurveys(
        JsonObject manifest,
        IReadOnlyDictionary<string, string> entries)
    {
        JsonArray authored = manifest["surveys"] as JsonArray
            ?? throw new InvalidDataException("The bundle manifest must contain a surveys array.");
        var surveys = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (JsonNode? node in authored)
        {
            JsonObject item = node as JsonObject
                ?? throw new InvalidDataException("Every manifest survey must be an object.");
            string expectedDigest = ReadString(item, "digest");
            ValidateDigest(expectedDigest);
            string path = ReadString(item, "path");
            if (!string.Equals(path, $"surveys/{expectedDigest[7..]}.json", StringComparison.Ordinal))
            {
                throw new InvalidDataException("A manifest survey path must be derived from its digest.");
            }
            SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(ReadRequired(entries, path));
            if (parsed.Diagnostics.Any(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error))
            {
                throw new InvalidDataException($"Survey '{expectedDigest}' contains definition errors.");
            }
            string actualDigest = parsed.Definition.DefinitionDigest;
            if (!string.Equals(expectedDigest, actualDigest, StringComparison.Ordinal))
            {
                throw new InvalidDataException(
                    $"Survey entry '{path}' has digest '{actualDigest}', expected '{expectedDigest}'.");
            }
            if (!surveys.TryAdd(actualDigest, parsed.Definition.ToCanonicalJson()))
            {
                throw new InvalidDataException($"Duplicate survey digest '{actualDigest}'.");
            }
        }
        return surveys;
    }

    private static string[] ReadBindings(JsonObject manifest)
    {
        JsonArray authored = manifest["requiredBindings"] as JsonArray
            ?? throw new InvalidDataException(
                "The bundle manifest must contain a requiredBindings array.");
        string[] bindings = authored.Select(node =>
        {
            string value = node?.GetValue<string>()
                ?? throw new InvalidDataException("Every required binding must be a string.");
            ValidateName(value, "required binding");
            return value;
        }).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        if (bindings.Length != authored.Count)
        {
            throw new InvalidDataException("Required binding names must be unique.");
        }
        return bindings;
    }

    private static void ValidateClosure(
        WorkflowDefinition workflow,
        Dictionary<string, string> surveys)
    {
        foreach (string digest in workflow.Steps
            .Where(step => step.Kind == WorkflowStepKind.Survey)
            .Select(step => step.SurveyDefinitionDigest!))
        {
            if (!surveys.ContainsKey(digest))
            {
                throw new InvalidDataException(
                    $"Workflow references survey '{digest}' that is absent from the bundle.");
            }
        }
    }

    private static void EnsureNoUnexpectedEntries(
        IReadOnlyDictionary<string, string> entries,
        IEnumerable<string> surveyDigests)
    {
        var expected = new HashSet<string>(["manifest.json", "workflow.json"], StringComparer.Ordinal);
        foreach (string digest in surveyDigests)
        {
            _ = expected.Add($"surveys/{digest[7..]}.json");
        }
        string? unexpected = entries.Keys.FirstOrDefault(path => !expected.Contains(path));
        if (unexpected is not null)
        {
            throw new InvalidDataException($"Unexpected bundle entry '{unexpected}'.");
        }
    }

    private static void ValidateEntryName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)
            || name.StartsWith('/')
            || name.Contains("..", StringComparison.Ordinal)
            || name.Contains('\\'))
        {
            throw new InvalidDataException($"Unsafe bundle entry name '{name}'.");
        }
    }

    private static JsonObject ParseObject(string json, string description)
    {
        try
        {
            return JsonNode.Parse(json) as JsonObject
                ?? throw new InvalidDataException($"The bundle {description} must be a JSON object.");
        }
        catch (JsonException exception)
        {
            throw new InvalidDataException($"The bundle {description} is invalid JSON.", exception);
        }
    }

    private static string ReadRequired(IReadOnlyDictionary<string, string> entries, string path)
    {
        return entries.TryGetValue(path, out string? content)
            ? content
            : throw new InvalidDataException($"Required bundle entry '{path}' is missing.");
    }

    private static int ReadInt(JsonObject node, string propertyName)
    {
        try
        {
            return node[propertyName]?.GetValue<int>()
                ?? throw new InvalidDataException(
                    $"Manifest property '{propertyName}' must be an integer.");
        }
        catch (InvalidOperationException exception)
        {
            throw new InvalidDataException(
                $"Manifest property '{propertyName}' must be an integer.", exception);
        }
    }

    private static int ReadPositiveInt(JsonObject node, string propertyName)
    {
        int value = ReadInt(node, propertyName);
        return value > 0
            ? value
            : throw new InvalidDataException(
                $"Manifest property '{propertyName}' must be positive.");
    }

    private static string ReadName(JsonObject node, string propertyName)
    {
        string value = ReadString(node, propertyName);
        ValidateName(value, $"manifest property '{propertyName}'");
        return value;
    }

    private static string ReadString(JsonObject node, string propertyName)
    {
        try
        {
            return node[propertyName]?.GetValue<string>()
                ?? throw new InvalidDataException(
                    $"Manifest property '{propertyName}' must be a string.");
        }
        catch (InvalidOperationException exception)
        {
            throw new InvalidDataException(
                $"Manifest property '{propertyName}' must be a string.", exception);
        }
    }

    private static void ValidateName(string value, string description)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw new InvalidDataException($"The {description} must contain 1 to 128 characters.");
        }
    }

    private static void ValidateDigest(string value)
    {
        if (value.Length != 71
            || !value.StartsWith("sha256:", StringComparison.Ordinal)
            || value[7..].Any(character => !Uri.IsHexDigit(character) || char.IsUpper(character)))
        {
            throw new InvalidDataException("A manifest survey digest must be lowercase SHA-256.");
        }
    }
}
