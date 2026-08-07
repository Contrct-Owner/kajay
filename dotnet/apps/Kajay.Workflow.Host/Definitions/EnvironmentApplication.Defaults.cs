using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class EnvironmentApplication
{
    private static readonly EnvironmentDefault[] Defaults =
    [
        new("development", "Development", RequiresApproval: false, Position: 100),
        new("test", "Test", RequiresApproval: false, Position: 200),
        new("staging", "Staging", RequiresApproval: false, Position: 300),
        new("production", "Production", RequiresApproval: true, Position: 400),
    ];

    internal async Task EnsureDefaultsAsync(
        string tenantId,
        string actorId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        string lockName = $"environment-defaults:{tenantId}";
        _ = await _database.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockName}, 0))",
            cancellationToken).ConfigureAwait(false);
        string[] existing = await _database.Environments
            .Where(item => item.TenantId == tenantId)
            .Select(item => item.Name)
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
        var names = new HashSet<string>(existing, StringComparer.Ordinal);
        foreach (EnvironmentDefault item in Defaults.Where(item => !names.Contains(item.Name)))
        {
            EnvironmentRecord environment = NewEnvironment(
                tenantId, actorId, item.Name, item.DisplayName, item.RequiresApproval,
                item.Position, now);
            _database.Environments.Add(environment);
            AppendEnvironmentAudit(environment, actorId, "environment-created", now);
        }
    }

    private sealed record EnvironmentDefault(
        string Name,
        string DisplayName,
        bool RequiresApproval,
        int Position);
}
