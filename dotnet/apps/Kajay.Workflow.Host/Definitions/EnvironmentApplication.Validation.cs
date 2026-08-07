using System.Globalization;
using System.Text.RegularExpressions;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class EnvironmentApplication
{
    [GeneratedRegex(
        "^[a-z0-9][a-z0-9-]{0,127}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking)]
    private static partial Regex EnvironmentNamePattern();

    private static EnvironmentRecord NewEnvironment(
        string tenantId,
        string actorId,
        string name,
        string displayName,
        bool requiresApproval,
        int position,
        DateTimeOffset now) =>
        new()
        {
            TenantId = tenantId,
            Name = name,
            DisplayName = displayName,
            RequiresApproval = requiresApproval,
            Position = position,
            Version = 1,
            CreatedBy = actorId,
            CreatedAt = now,
            UpdatedBy = actorId,
            UpdatedAt = now,
        };

    private static EnvironmentResult ToResult(EnvironmentRecord environment) =>
        new(
            environment.Name,
            environment.DisplayName,
            environment.RequiresApproval,
            environment.Position,
            environment.Version,
            environment.CreatedBy,
            environment.CreatedAt,
            environment.UpdatedBy,
            environment.UpdatedAt);

    private static string ValidateEnvironmentName(string value)
    {
        string name = value.Trim();
        if (!EnvironmentNamePattern().IsMatch(name))
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-environment-name",
                "Environment name must be a lowercase slug up to 128 characters.");
        }
        return name;
    }

    private static string ValidateDisplayName(string value)
    {
        string name = value.Trim();
        if (name.Length is 0 or > 128)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-environment-display-name",
                "Environment display name must contain 1 to 128 characters.");
        }
        return name;
    }

    private static string ValidateBindingName(string value)
    {
        string name = value.Trim();
        if (name.Length is 0 or > 128 || name.Contains('/', StringComparison.Ordinal))
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-binding-name",
                "Binding name must contain 1 to 128 characters and cannot contain '/'.");
        }
        return name;
    }

    private static string ValidateReference(string value)
    {
        string reference = value.Trim();
        if (reference.Length is 0 or > 2048)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-binding-reference",
                "Binding reference must contain 1 to 2048 characters.");
        }
        return reference;
    }

    private static void ValidatePosition(int value)
    {
        if (value is < 0 or > 10_000)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-environment-position",
                "Environment position must be between 0 and 10000.");
        }
    }

    private static void RequireVersion(long expected, long actual, string code)
    {
        if (expected != actual)
        {
            throw Problem(StatusCodes.Status412PreconditionFailed, code,
                $"Expected version {expected.ToString(CultureInfo.InvariantCulture)}, but the "
                    + $"current version is {actual.ToString(CultureInfo.InvariantCulture)}.");
        }
    }

    private async Task SaveChangesAsync(
        long expectedVersion,
        string conflictCode,
        CancellationToken cancellationToken)
    {
        try
        {
            await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw Problem(StatusCodes.Status412PreconditionFailed, conflictCode,
                $"Expected version {expectedVersion.ToString(CultureInfo.InvariantCulture)}, "
                    + "but the current version changed.");
        }
    }

    private async Task<IDbContextTransaction> BeginLockAsync(
        string key,
        CancellationToken cancellationToken)
    {
        IDbContextTransaction transaction = await _database.Database
            .BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _ = await _database.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))",
                cancellationToken).ConfigureAwait(false);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private static WorkflowProblemException Problem(int status, string code, string message) =>
        new(status, code, message);
}
