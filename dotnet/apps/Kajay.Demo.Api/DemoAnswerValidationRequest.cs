using System.Text.Json;

namespace Kajay.Demo.Api;

public sealed record DemoAnswerValidationRequest(
    JsonElement Data,
    IReadOnlyList<string> QuestionNames);
