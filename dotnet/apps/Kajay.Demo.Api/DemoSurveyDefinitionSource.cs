using System.Reflection;

namespace Kajay.Demo.Api;

internal static class DemoSurveyDefinitionSource
{
    internal static string Read()
    {
        Assembly assembly = typeof(DemoSurveyDefinitionSource).Assembly;
        using Stream stream = assembly.GetManifestResourceStream("Kajay.Demo.Api.demo-survey.json")
            ?? throw new InvalidOperationException("The embedded demo survey is missing.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
