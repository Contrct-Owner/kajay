using System.Text.Json;

namespace Kajay.Demo.Api;

public sealed record DemoSubmissionRequest(JsonElement Definition, JsonElement Data);
