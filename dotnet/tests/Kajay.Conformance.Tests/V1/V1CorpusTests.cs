using System.Text.Json;

namespace Kajay.Conformance.Tests;

public sealed class V1CorpusTests
{
    [Fact]
    public void VersionOneCorpusIsAvailableForTheFutureRuntimeAdapter()
    {
        int definitions = CountArray("definitions.json", "cases");
        int parsing = CountArray("expressions.json", "parsing");
        int evaluation = CountArray("expressions.json", "evaluation");
        int lifecycle = CountArray("lifecycle.json", "scenarios");

        Assert.Equal(31, definitions + parsing + evaluation + lifecycle);
    }

    private static int CountArray(string fileName, string propertyName)
    {
        string path = Path.Combine(AppContext.BaseDirectory, "Conformance", "v1", fileName);
        using JsonDocument document = JsonDocument.Parse(File.ReadAllBytes(path));
        return document.RootElement.GetProperty(propertyName).GetArrayLength();
    }
}
