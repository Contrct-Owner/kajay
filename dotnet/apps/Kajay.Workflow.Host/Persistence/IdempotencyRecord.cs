namespace Kajay.Workflow.Host.Persistence;

internal sealed class IdempotencyRecord
{
    public required string TenantId { get; set; }

    public required string Key { get; set; }

    public required string Operation { get; set; }

    public required string RequestHash { get; set; }

    public required string ResultJson { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
