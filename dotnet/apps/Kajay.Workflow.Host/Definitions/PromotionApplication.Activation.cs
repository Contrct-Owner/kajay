using System.Globalization;
using System.Text.Json;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class PromotionApplication
{
    internal async Task SetBindingAsync(
        string tenantId,
        string actorId,
        string environmentName,
        string name,
        string reference,
        CancellationToken cancellationToken)
    {
        ValidateName(environmentName, nameof(environmentName));
        ValidateName(name, nameof(name));
        ValidateName(reference, nameof(reference));
        DateTimeOffset now = _timeProvider.GetUtcNow();
        EnvironmentBindingRecord? binding = await _database.EnvironmentBindings.FindAsync(
            [tenantId, environmentName, name],
            cancellationToken).ConfigureAwait(false);
        if (binding is null)
        {
            binding = NewBinding(tenantId, environmentName, name, reference, now);
            _database.EnvironmentBindings.Add(binding);
        }
        else
        {
            binding.Reference = reference;
            binding.UpdatedAt = now;
        }
        AppendBindingAudit(tenantId, actorId, environmentName, name, now);
        await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task<ActivationResult> ActivateAsync(
        string tenantId,
        string actorId,
        string environmentName,
        string managedDefinitionName,
        string releaseDigest,
        long expectedVersion,
        string? approvedBy,
        CancellationToken cancellationToken)
    {
        ValidateActivation(environmentName, managedDefinitionName, approvedBy);
        await using IDbContextTransaction transaction = await BeginManagementLockAsync(
            $"activate:{tenantId}:{environmentName}:{managedDefinitionName}",
            cancellationToken).ConfigureAwait(false);
        DefinitionReleaseRecord release = await LoadReleaseAsync(
            tenantId, managedDefinitionName, releaseDigest, cancellationToken)
            .ConfigureAwait(false);
        await RequireBindingsAsync(tenantId, environmentName, release, cancellationToken)
            .ConfigureAwait(false);
        ActivationRecord? activation = await _database.Activations.FindAsync(
            [tenantId, environmentName, managedDefinitionName],
            cancellationToken).ConfigureAwait(false);
        if ((activation?.Version ?? 0) != expectedVersion)
        {
            throw VersionConflict(expectedVersion, activation?.Version ?? 0);
        }

        DateTimeOffset now = _timeProvider.GetUtcNow();
        activation = SetActivation(
            activation,
            tenantId,
            environmentName,
            managedDefinitionName,
            releaseDigest,
            approvedBy,
            now);
        AppendActivationAudit(tenantId, actorId, activation, now);
        try
        {
            await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw VersionConflict(expectedVersion, null);
        }
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToActivationResult(activation);
    }

    private async Task<DefinitionReleaseRecord> LoadReleaseAsync(
        string tenantId,
        string managedDefinitionName,
        string releaseDigest,
        CancellationToken cancellationToken)
    {
        DefinitionReleaseRecord release = await _database.DefinitionReleases.SingleOrDefaultAsync(
            item => item.TenantId == tenantId && item.Digest == releaseDigest,
            cancellationToken).ConfigureAwait(false)
            ?? throw Problem(
                StatusCodes.Status404NotFound,
                "release-not-installed",
                $"Definition release '{releaseDigest}' is not installed.");
        if (!string.Equals(
            release.ManagedDefinitionName,
            managedDefinitionName,
            StringComparison.Ordinal))
        {
            throw Problem(
                StatusCodes.Status409Conflict,
                "managed-definition-mismatch",
                "The release belongs to a different Managed Definition.");
        }
        return release;
    }

    private async Task RequireBindingsAsync(
        string tenantId,
        string environmentName,
        DefinitionReleaseRecord release,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> missing = await FindMissingBindingsAsync(
            tenantId,
            environmentName,
            release.RequiredBindings,
            cancellationToken).ConfigureAwait(false);
        if (missing.Count != 0)
        {
            throw Problem(
                StatusCodes.Status422UnprocessableEntity,
                "missing-environment-bindings",
                $"Activation is missing bindings: {string.Join(", ", missing)}.");
        }
    }

    private ActivationRecord SetActivation(
        ActivationRecord? activation,
        string tenantId,
        string environmentName,
        string managedDefinitionName,
        string releaseDigest,
        string? approvedBy,
        DateTimeOffset now)
    {
        if (activation is null)
        {
            activation = new ActivationRecord
            {
                TenantId = tenantId,
                EnvironmentName = environmentName,
                ManagedDefinitionName = managedDefinitionName,
                ReleaseDigest = releaseDigest,
                Version = 1,
                ApprovedBy = approvedBy,
                ActivatedAt = now,
            };
            _database.Activations.Add(activation);
            return activation;
        }
        activation.ReleaseDigest = releaseDigest;
        activation.Version += 1;
        activation.ApprovedBy = approvedBy;
        activation.ActivatedAt = now;
        return activation;
    }

    private void AppendBindingAudit(
        string tenantId,
        string actorId,
        string environmentName,
        string name,
        DateTimeOffset now)
    {
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            Subject = $"{environmentName}/{name}",
            EventType = "environment-binding-set",
            PayloadJson = JsonSerializer.Serialize(new { environmentName, name }),
            ActorId = actorId,
            OccurredAt = now,
        });
    }

    private void AppendActivationAudit(
        string tenantId,
        string actorId,
        ActivationRecord activation,
        DateTimeOffset now)
    {
        _database.ManagementAuditEvents.Add(new ManagementAuditEventRecord
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            Subject = $"{activation.EnvironmentName}/{activation.ManagedDefinitionName}",
            EventType = "definition-release-activated",
            PayloadJson = JsonSerializer.Serialize(new
            {
                releaseDigest = activation.ReleaseDigest,
                activation.Version,
                activation.ApprovedBy,
            }),
            ActorId = actorId,
            OccurredAt = now,
        });
    }

    private static EnvironmentBindingRecord NewBinding(
        string tenantId,
        string environmentName,
        string name,
        string reference,
        DateTimeOffset now)
    {
        return new EnvironmentBindingRecord
        {
            TenantId = tenantId,
            EnvironmentName = environmentName,
            Name = name,
            Reference = reference,
            UpdatedAt = now,
        };
    }

    private static void ValidateActivation(
        string environmentName,
        string managedDefinitionName,
        string? approvedBy)
    {
        ValidateName(environmentName, nameof(environmentName));
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        if (string.Equals(environmentName, "production", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(approvedBy))
        {
            throw Problem(
                StatusCodes.Status422UnprocessableEntity,
                "approval-required",
                "Production activation requires an explicit approval identity.");
        }
    }

    private static ActivationResult ToActivationResult(ActivationRecord activation)
    {
        return new ActivationResult(
            activation.EnvironmentName,
            activation.ManagedDefinitionName,
            activation.ReleaseDigest,
            activation.Version,
            activation.ApprovedBy);
    }

    private static WorkflowProblemException VersionConflict(long expected, long? actual)
    {
        string actualText = actual?.ToString(CultureInfo.InvariantCulture) ?? "unknown";
        return new WorkflowProblemException(
            StatusCodes.Status412PreconditionFailed,
            "activation-version-conflict",
            $"Expected activation version {expected}, but the current version is {actualText}.");
    }

    private static void ValidateName(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw Problem(
                StatusCodes.Status400BadRequest,
                "invalid-name",
                $"{parameterName} must contain 1 to 128 characters.");
        }
    }
}
