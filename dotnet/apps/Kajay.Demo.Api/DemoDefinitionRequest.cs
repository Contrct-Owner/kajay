using System.Text.Json;

namespace Kajay.Demo.Api;

public sealed record DemoDefinitionRequest(JsonElement Definition);
