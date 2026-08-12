export const DOTNET_QUICKSTART = `using Kajay;

const string json = """
{
  "schemaVersion": 1,
  "pages": [{
    "name": "feedback",
    "elements": [{ "type": "text", "name": "email", "isRequired": true }]
  }]
}
""";

SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(json);
foreach (DefinitionDiagnostic diagnostic in parsed.Diagnostics)
{
    Console.WriteLine($"{diagnostic.Severity}: {diagnostic.Code} at {diagnostic.Path}");
}

Survey survey = parsed.Definition.CreateSurvey();
survey.SetValue("email", KajayValue.From("person@example.com"));
SurveyAdvanceOutcome outcome = await survey.AdvanceAsync();`;

export const DOTNET_SNAPSHOT = `using Kajay;
using Kajay.Snapshots;

SurveyDefinition definition = SurveyDefinition.Parse(json).Definition;
Survey source = definition.CreateSurvey();
source.SetValue("email", KajayValue.From("person@example.com"));

string storedJson = source.CreateSnapshot().ToJson();

Survey restored = definition.CreateSurvey();
restored.RestoreSnapshot(SurveySnapshot.Parse(storedJson));`;

export const DOTNET_HOST_OPTIONS = `using Kajay;
using Kajay.Hosting;

var options = new SurveyOptions
{
    TimeProvider = TimeProvider.System,
    Endpoints = new Dictionary<string, string>
    {
        ["directory"] = "https://api.example.com"
    },
    ChoiceFetcher = async (request, cancellationToken) =>
    {
        // Resolve request.Url through the host's authenticated HTTP policy.
        return await LoadChoicesAsync(request, cancellationToken);
    }
};

Survey survey = await definition.CreateSurveyAsync(options, cancellationToken);`;

export const DOTNET_EXTENSION = `using Kajay;
using Kajay.Extensibility;

SurveyDefinitionRegistry registry = SurveyDefinitionRegistry.Default.WithProperty(
    "question",
    new SurveyDefinitionPropertyRegistration(
        "analyticsKey",
        SurveyDefinitionPropertyType.Text));

SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(json, registry);`;
