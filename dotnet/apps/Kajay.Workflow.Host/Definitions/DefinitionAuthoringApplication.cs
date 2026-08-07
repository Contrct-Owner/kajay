using System.Globalization;
using System.Text.Json;
using Kajay;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Contracts;
using Kajay.Workflow.Host.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionAuthoringApplication
{
    private readonly WorkflowDbContext _database;
    private readonly PromotionApplication _promotion;
    private readonly EnvironmentApplication _environments;
    private readonly TimeProvider _timeProvider;

    public DefinitionAuthoringApplication(
        WorkflowDbContext database,
        PromotionApplication promotion,
        EnvironmentApplication environments,
        TimeProvider timeProvider)
    {
        _database = database;
        _promotion = promotion;
        _environments = environments;
        _timeProvider = timeProvider;
    }

    internal async Task<DefinitionDraftResult> GetDraftAsync(
        string tenantId,
        string managedDefinitionName,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        DefinitionDraftRecord draft = await _database.DefinitionDrafts.AsNoTracking()
            .SingleOrDefaultAsync(item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName, cancellationToken)
            .ConfigureAwait(false)
            ?? throw Problem(StatusCodes.Status404NotFound, "definition-draft-not-found",
                $"Managed Definition '{managedDefinitionName}' has no draft.");
        return ToDraftResult(draft, created: false);
    }

    internal async Task<DefinitionDraftResult> SaveDraftAsync(
        string tenantId,
        string actorId,
        string managedDefinitionName,
        long expectedVersion,
        JsonElement authoredDefinition,
        CancellationToken cancellationToken)
    {
        ValidateName(managedDefinitionName, nameof(managedDefinitionName));
        SurveyDefinition definition = ParseDefinition(authoredDefinition);
        await using IDbContextTransaction transaction = await BeginLockAsync(
            $"draft:{tenantId}:{managedDefinitionName}", cancellationToken).ConfigureAwait(false);
        DefinitionDraftRecord? draft = await LoadDraftAsync(
            tenantId, managedDefinitionName, cancellationToken).ConfigureAwait(false);
        RequireVersion(expectedVersion, draft?.Version ?? 0, "definition-draft-version-conflict");
        bool created = draft is null;
        DateTimeOffset now = _timeProvider.GetUtcNow();
        draft = created
            ? CreateDraft(tenantId, actorId, managedDefinitionName, definition, now)
            : UpdateDraft(draft!, actorId, definition, now);
        if (created)
        {
            await _environments.EnsureDefaultsAsync(
                tenantId, actorId, now, cancellationToken).ConfigureAwait(false);
        }
        AppendAudit(tenantId, actorId, managedDefinitionName,
            created ? "definition-draft-created" : "definition-draft-saved", draft.Version, now);
        await _database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ToDraftResult(draft, created);
    }

    private async Task<DefinitionDraftRecord?> LoadDraftAsync(
        string tenantId,
        string managedDefinitionName,
        CancellationToken cancellationToken)
    {
        return await _database.DefinitionDrafts.SingleOrDefaultAsync(
            item => item.TenantId == tenantId
                && item.ManagedDefinitionName == managedDefinitionName,
            cancellationToken).ConfigureAwait(false);
    }

    private DefinitionDraftRecord CreateDraft(
        string tenantId,
        string actorId,
        string managedDefinitionName,
        SurveyDefinition definition,
        DateTimeOffset now)
    {
        _database.ManagedDefinitions.Add(new ManagedDefinitionRecord
        {
            TenantId = tenantId,
            Name = managedDefinitionName,
            CreatedBy = actorId,
            CreatedAt = now,
        });
        var draft = new DefinitionDraftRecord
        {
            TenantId = tenantId,
            ManagedDefinitionName = managedDefinitionName,
            DefinitionJson = definition.ToCanonicalJson(),
            DefinitionDigest = definition.DefinitionDigest,
            Version = 1,
            UpdatedBy = actorId,
            UpdatedAt = now,
        };
        _database.DefinitionDrafts.Add(draft);
        return draft;
    }

    private static DefinitionDraftRecord UpdateDraft(
        DefinitionDraftRecord draft,
        string actorId,
        SurveyDefinition definition,
        DateTimeOffset now)
    {
        draft.DefinitionJson = definition.ToCanonicalJson();
        draft.DefinitionDigest = definition.DefinitionDigest;
        draft.Version += 1;
        draft.UpdatedBy = actorId;
        draft.UpdatedAt = now;
        return draft;
    }

    private static SurveyDefinition ParseDefinition(JsonElement authored)
    {
        if (authored.ValueKind != JsonValueKind.Object)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-definition-body",
                "Definition must be a JSON object.");
        }
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(authored.GetRawText());
        DefinitionDiagnostic? error = parsed.Diagnostics.FirstOrDefault(
            item => item.Severity == DiagnosticSeverity.Error);
        return error is null
            ? parsed.Definition
            : throw Problem(StatusCodes.Status422UnprocessableEntity, "invalid-definition",
                $"{error.Code} at {error.Path}.");
    }

    private static DefinitionDraftResult ToDraftResult(
        DefinitionDraftRecord draft,
        bool created)
    {
        return new DefinitionDraftResult(
            draft.ManagedDefinitionName,
            JsonSerializer.Deserialize<JsonElement>(draft.DefinitionJson),
            draft.DefinitionDigest,
            draft.Version,
            draft.UpdatedBy,
            draft.UpdatedAt,
            created);
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

    private static void RequireVersion(long expected, long actual, string code)
    {
        if (expected != actual)
        {
            throw Problem(StatusCodes.Status412PreconditionFailed, code,
                $"Expected version {expected.ToString(CultureInfo.InvariantCulture)}, but the "
                    + $"current version is {actual.ToString(CultureInfo.InvariantCulture)}.");
        }
    }

    private static void ValidateName(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            throw Problem(StatusCodes.Status400BadRequest, "invalid-name",
                $"{parameterName} must contain 1 to 128 characters.");
        }
    }

    private static WorkflowProblemException Problem(int status, string code, string message) =>
        new(status, code, message);
}
