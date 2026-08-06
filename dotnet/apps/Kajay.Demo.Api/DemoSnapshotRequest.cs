using System.Text.Json;

namespace Kajay.Demo.Api;

public sealed record DemoSnapshotRequest(JsonElement Definition, JsonElement Data);
