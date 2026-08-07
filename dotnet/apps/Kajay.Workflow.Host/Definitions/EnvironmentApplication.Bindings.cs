using System.Text.Json;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class EnvironmentApplication
{
    internal async Task<EnvironmentBindingResult[]> ListBindingsAsync(
        string tenantId,
        string environmentName,
        CancellationToken cancellationToken)
    {
        EnvironmentRecord environment = await GetRequiredAsync(
            tenantId, environmentName, cancellationToken).ConfigureAwait(false);
        return await _database.EnvironmentBindings.AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.EnvironmentName == environment.Name)
            .OrderBy(item => item.Name)
            .Select(item => new EnvironmentBindingResult(
                item.EnvironmentName,
                item.Name,
                item.Version,
                item.UpdatedBy,
                item.UpdatedAt))
            .ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task<EnvironmentBindingResult> SetBindingAsync(
        string tenantId,
        string actorId,
        string environmentName,
        string bindingName,
        string reference,
        long expectedVersion,
        CancellationToken cancellationToken)
    {
        string environment = ValidateEnvironmentName(environmentName);
        string name = ValidateBindingName(bindingName);
        string normalizedReference = ValidateReference(reference);
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"environment-binding:{tenantId}:{environment}:{name}", cancellationToken)
            .ConfigureAwait(false);
        _ = await GetRequiredAsync(tenantId, environment, cancellationToken)
            .ConfigureAwait(false);
        EnvironmentBindingRecord? binding = await _database.EnvironmentBindings.FindAsync(
            [tenantId, environment, name], cancellationToken).ConfigureAwait(false);
        RequireVersion(expectedVersion, binding?.Version ?? 0, "binding-version-conflict");
        DateTimeOffset now = _timeProvider.GetUtcNow();
        if (binding is null)
        {
            binding = new EnvironmentBindingRecord
            {
                TenantId = tenantId,
                EnvironmentName = environment,
                Name = name,
                Reference = normalizedReference,
                Version = 1,
                UpdatedBy = actorId,
                UpdatedAt = now,
            };
            _database.EnvironmentBindings.Add(binding);
        }
        else
        {
            binding.Reference = normalizedReference;
            binding.Version += 1;
            binding.UpdatedBy = actorId;
            binding.UpdatedAt = now;
        }
        AppendBindingAudit(binding, actorId, "environment-binding-set", now);
        await SaveChangesAsync(
            expectedVersion, "binding-version-conflict", cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToBindingResult(binding);
    }

    internal async Task RemoveBindingAsync(
        string tenantId,
        string actorId,
        string environmentName,
        string bindingName,
        long expectedVersion,
        CancellationToken cancellationToken)
    {
        string environment = ValidateEnvironmentName(environmentName);
        string name = ValidateBindingName(bindingName);
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"environment-binding:{tenantId}:{environment}:{name}", cancellationToken)
            .ConfigureAwait(false);
        _ = await GetRequiredAsync(tenantId, environment, cancellationToken)
            .ConfigureAwait(false);
        EnvironmentBindingRecord binding = await _database.EnvironmentBindings.FindAsync(
            [tenantId, environment, name], cancellationToken).ConfigureAwait(false)
            ?? throw Problem(StatusCodes.Status404NotFound, "environment-binding-not-found",
                $"Binding '{name}' is not configured in Environment '{environment}'.");
        RequireVersion(expectedVersion, binding.Version, "binding-version-conflict");
        DateTimeOffset now = _timeProvider.GetUtcNow();
        _database.EnvironmentBindings.Remove(binding);
        AppendBindingAudit(binding, actorId, "environment-binding-removed", now);
        await SaveChangesAsync(
            expectedVersion, "binding-version-conflict", cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    private void AppendBindingAudit(
        EnvironmentBindingRecord binding,
        string actorId,
        string eventType,
        DateTimeOffset now)
    {
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = binding.TenantId,
            Subject = $"{binding.EnvironmentName}/{binding.Name}",
            EventType = eventType,
            PayloadJson = JsonSerializer.Serialize(new
            {
                environmentName = binding.EnvironmentName,
                name = binding.Name,
                version = binding.Version,
            }),
            ActorId = actorId,
            OccurredAt = now,
        });
    }

    private static EnvironmentBindingResult ToBindingResult(EnvironmentBindingRecord binding) =>
        new(
            binding.EnvironmentName,
            binding.Name,
            binding.Version,
            binding.UpdatedBy,
            binding.UpdatedAt);
}
