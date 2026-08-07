using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Workflow.Host.Definitions;

internal sealed class WorkflowDefinition
{
    private readonly Dictionary<string, WorkflowStep> _steps;

    private WorkflowDefinition(string initialStep, Dictionary<string, WorkflowStep> steps)
    {
        InitialStep = initialStep;
        _steps = steps;
    }

    internal string InitialStep { get; }

    internal IReadOnlyCollection<WorkflowStep> Steps => _steps.Values;

    internal IReadOnlyList<WorkflowStep> ExecutionSteps()
    {
        var result = new List<WorkflowStep>(_steps.Count);
        WorkflowStep step = GetStep(InitialStep);
        while (true)
        {
            result.Add(step);
            if (step.Next is null)
            {
                return result;
            }
            step = GetStep(step.Next);
        }
    }

    internal WorkflowStep GetStep(string key)
    {
        return _steps.TryGetValue(key, out WorkflowStep? step)
            ? step
            : throw new InvalidOperationException($"Workflow step '{key}' does not exist.");
    }

    internal static WorkflowDefinition Parse(string json)
    {
        ArgumentNullException.ThrowIfNull(json);
        JsonObject root = JsonNode.Parse(json) as JsonObject
            ?? throw new JsonException("A workflow definition must be a JSON object.");
        if (ReadInt(root, "formatVersion") != 1)
        {
            throw new JsonException("Only workflow definition format version 1 is supported.");
        }

        string initialStep = ReadName(root, "initialStep");
        JsonArray authoredSteps = root["steps"] as JsonArray
            ?? throw new JsonException("A workflow definition must contain a steps array.");
        Dictionary<string, WorkflowStep> steps = authoredSteps
            .Select(ReadStep)
            .ToDictionary(step => step.Key, StringComparer.Ordinal);
        ValidateGraph(initialStep, steps);
        return new WorkflowDefinition(initialStep, steps);
    }

    internal string ToCanonicalJson()
    {
        var root = new JsonObject
        {
            ["formatVersion"] = 1,
            ["initialStep"] = InitialStep,
            ["steps"] = new JsonArray(_steps.Values
                .OrderBy(step => step.Key, StringComparer.Ordinal)
                .Select(step => (JsonNode?)WriteStep(step)).ToArray()),
        };
        return CanonicalJson.Stringify(root);
    }

    private static WorkflowStep ReadStep(JsonNode? node)
    {
        JsonObject authored = node as JsonObject
            ?? throw new JsonException("Each workflow step must be an object.");
        string key = ReadName(authored, "key");
        string kind = ReadName(authored, "kind");
        return kind switch
        {
            "survey" => new WorkflowStep
            {
                Key = key,
                Kind = WorkflowStepKind.Survey,
                SurveyDefinitionDigest = ReadDigest(authored, "surveyDefinitionDigest"),
                Next = ReadName(authored, "next"),
            },
            "delay" => new WorkflowStep
            {
                Key = key,
                Kind = WorkflowStepKind.Delay,
                Delay = TimeSpan.FromSeconds(ReadPositiveDouble(authored, "delaySeconds")),
                Next = ReadName(authored, "next"),
            },
            "effect" => new WorkflowStep
            {
                Key = key,
                Kind = WorkflowStepKind.Effect,
                EffectType = ReadName(authored, "effectType"),
                EffectPayload = authored["payload"]?.DeepClone() ?? new JsonObject(),
                Next = ReadName(authored, "next"),
            },
            "end" => new WorkflowStep { Key = key, Kind = WorkflowStepKind.End },
            _ => throw new JsonException($"Workflow step '{key}' has unknown kind '{kind}'."),
        };
    }

    private static JsonObject WriteStep(WorkflowStep step)
    {
        var node = new JsonObject
        {
            ["key"] = step.Key,
            ["kind"] = step.Kind.ToString().ToLowerInvariant(),
        };
        switch (step.Kind)
        {
            case WorkflowStepKind.Survey:
                node["surveyDefinitionDigest"] = step.SurveyDefinitionDigest;
                node["next"] = step.Next;
                break;
            case WorkflowStepKind.Delay:
                node["delaySeconds"] = step.Delay!.Value.TotalSeconds;
                node["next"] = step.Next;
                break;
            case WorkflowStepKind.Effect:
                node["effectType"] = step.EffectType;
                node["payload"] = step.EffectPayload is null
                    ? null
                    : CanonicalJson.Sort(step.EffectPayload);
                node["next"] = step.Next;
                break;
            case WorkflowStepKind.End:
                break;
            default:
                throw new InvalidOperationException($"Unsupported workflow step kind {step.Kind}.");
        }
        return node;
    }

    private static void ValidateGraph(
        string initialStep,
        Dictionary<string, WorkflowStep> steps)
    {
        if (steps.Count == 0 || !steps.ContainsKey(initialStep))
        {
            throw new JsonException("The initial workflow step does not exist.");
        }

        var visited = new HashSet<string>(StringComparer.Ordinal);
        var active = new HashSet<string>(StringComparer.Ordinal);
        Visit(initialStep, steps, visited, active);
        if (visited.Count != steps.Count)
        {
            throw new JsonException("Every workflow step must be reachable from the initial step.");
        }
    }

    private static void Visit(
        string key,
        Dictionary<string, WorkflowStep> steps,
        HashSet<string> visited,
        HashSet<string> active)
    {
        if (!active.Add(key))
        {
            throw new JsonException("Workflow definition format version 1 does not support loops.");
        }
        if (!visited.Add(key))
        {
            _ = active.Remove(key);
            return;
        }

        WorkflowStep step = steps[key];
        if (step.Next is not null)
        {
            if (!steps.ContainsKey(step.Next))
            {
                throw new JsonException(
                    $"Workflow step '{step.Key}' references missing step '{step.Next}'.");
            }
            Visit(step.Next, steps, visited, active);
        }
        _ = active.Remove(key);
    }

    private static int ReadInt(JsonObject node, string propertyName)
    {
        return node[propertyName]?.GetValue<int>()
            ?? throw new JsonException($"Workflow property '{propertyName}' must be an integer.");
    }

    private static double ReadPositiveDouble(JsonObject node, string propertyName)
    {
        double value = node[propertyName]?.GetValue<double>()
            ?? throw new JsonException($"Workflow property '{propertyName}' must be a number.");
        if (!double.IsFinite(value) || value <= 0)
        {
            throw new JsonException($"Workflow property '{propertyName}' must be positive.");
        }
        return value;
    }

    private static string ReadDigest(JsonObject node, string propertyName)
    {
        string digest = ReadName(node, propertyName);
        if (digest.Length != 71 || !digest.StartsWith("sha256:", StringComparison.Ordinal)
            || digest[7..].Any(character => !Uri.IsHexDigit(character) || char.IsUpper(character)))
        {
            throw new JsonException($"Workflow property '{propertyName}' must be a SHA-256 digest.");
        }
        return digest;
    }

    private static string ReadName(JsonObject node, string propertyName)
    {
        string value = node[propertyName]?.GetValue<string>()
            ?? throw new JsonException($"Workflow property '{propertyName}' must be a string.");
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw new JsonException(
                $"Workflow property '{propertyName}' must contain 1 to 128 characters.");
        }
        return value;
    }
}
