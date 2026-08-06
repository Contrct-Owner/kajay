using Kajay;

const string definitionJson = """
    {
      "pages":[
        {
          "name":"contact",
          "elements":[
            {"type":"text","name":"email","isRequired":true}
          ]
        }
      ]
    }
    """;

SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(definitionJson);
if (parsed.Diagnostics.Any(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error))
{
    foreach (DefinitionDiagnostic diagnostic in parsed.Diagnostics)
    {
        Console.Error.WriteLine(
            $"{diagnostic.Severity}: {diagnostic.Code} at {diagnostic.Path}");
    }
    return 1;
}

Survey survey = parsed.Definition.CreateSurvey();
survey.SetValue("email", KajayValue.From("person@example.com"));
SurveyAdvanceOutcome outcome = await survey.AdvanceAsync();

Console.WriteLine($"Outcome: {outcome}");
Console.WriteLine($"Email: {survey.Data["email"].GetString()}");
return 0;
