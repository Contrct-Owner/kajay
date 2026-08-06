using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kajay;

namespace Kajay.Workflow.Host.Tests;

internal static class KajayBundleFixture
{
    internal static byte[] Create(
        string managedDefinitionName = "onboarding",
        string versionLabel = "1.0.0",
        IReadOnlyList<string>? requiredBindings = null,
        bool includeEffect = false,
        double? delaySeconds = null)
    {
        return CreateScenario(
            managedDefinitionName,
            versionLabel,
            requiredBindings,
            includeEffect,
            delaySeconds).Bundle;
    }

    internal static KajayBundleScenario CreateScenario(
        string managedDefinitionName = "onboarding",
        string versionLabel = "1.0.0",
        IReadOnlyList<string>? requiredBindings = null,
        bool includeEffect = false,
        double? delaySeconds = null)
    {
        SurveyDefinition survey = SurveyDefinition.Parse("""
            {
              "title": "Onboarding",
              "pages": [{
                "name": "profile",
                "elements": [{ "type": "text", "name": "fullName", "required": true }]
              }]
            }
            """).Definition;
        JsonArray steps = CreateSteps(survey.DefinitionDigest, includeEffect, delaySeconds);
        string workflow = new JsonObject
        {
            ["formatVersion"] = 1,
            ["initialStep"] = "survey",
            ["steps"] = steps,
        }.ToJsonString();
        var manifest = new JsonObject
        {
            ["formatVersion"] = 1,
            ["managedDefinitionName"] = managedDefinitionName,
            ["versionLabel"] = versionLabel,
            ["conformanceVersion"] = 2,
            ["workflowPath"] = "workflow.json",
            ["surveys"] = new JsonArray(new JsonObject
            {
                ["digest"] = survey.DefinitionDigest,
                ["path"] = $"surveys/{survey.DefinitionDigest[7..]}.json",
            }),
            ["requiredBindings"] = new JsonArray((requiredBindings ?? [])
                .Select(value => (JsonNode?)value).ToArray()),
        };

        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            Write(archive, "manifest.json", manifest.ToJsonString());
            Write(archive, "workflow.json", workflow);
            Write(
                archive,
                $"surveys/{survey.DefinitionDigest[7..]}.json",
                survey.ToCanonicalJson());
        }
        return new KajayBundleScenario(output.ToArray(), survey);
    }

    private static JsonArray CreateSteps(
        string surveyDigest,
        bool includeEffect,
        double? delaySeconds)
    {
        var survey = new JsonObject
        {
            ["key"] = "survey",
            ["kind"] = "survey",
            ["surveyDefinitionDigest"] = surveyDigest,
            ["next"] = delaySeconds is not null ? "wait" : includeEffect ? "notify" : "end",
        };
        var end = new JsonObject { ["key"] = "end", ["kind"] = "end" };
        var steps = new JsonArray(survey);
        if (delaySeconds is not null)
        {
            steps.Add(new JsonObject
            {
                ["key"] = "wait",
                ["kind"] = "delay",
                ["delaySeconds"] = delaySeconds.Value,
                ["next"] = includeEffect ? "notify" : "end",
            });
        }
        if (includeEffect)
        {
            steps.Add(new JsonObject
            {
                ["key"] = "notify",
                ["kind"] = "effect",
                ["effectType"] = "test.notification",
                ["payload"] = new JsonObject { ["template"] = "welcome" },
                ["next"] = "end",
            });
        }
        steps.Add(end);
        return steps;
    }

    private static void Write(ZipArchive archive, string path, string value)
    {
        ZipArchiveEntry entry = archive.CreateEntry(path);
        using Stream stream = entry.Open();
        using var writer = new StreamWriter(stream, new UTF8Encoding(false));
        writer.Write(value);
    }
}

internal sealed record KajayBundleScenario(byte[] Bundle, SurveyDefinition Survey);
