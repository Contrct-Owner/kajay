using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Persistence;

internal sealed partial class WorkflowDbContext(DbContextOptions<WorkflowDbContext> options)
    : DbContext(options)
{
    internal DbSet<DefinitionReleaseRecord> DefinitionReleases => Set<DefinitionReleaseRecord>();

    internal DbSet<ManagedDefinitionRecord> ManagedDefinitions => Set<ManagedDefinitionRecord>();

    internal DbSet<DefinitionDraftRecord> DefinitionDrafts => Set<DefinitionDraftRecord>();

    internal DbSet<DefinitionRevisionRecord> DefinitionRevisions => Set<DefinitionRevisionRecord>();

    internal DbSet<DefinitionReleaseProvenanceRecord> DefinitionReleaseProvenance =>
        Set<DefinitionReleaseProvenanceRecord>();

    internal DbSet<ActivationRecord> Activations => Set<ActivationRecord>();

    internal DbSet<EnvironmentRecord> Environments => Set<EnvironmentRecord>();

    internal DbSet<EnvironmentBindingRecord> EnvironmentBindings =>
        Set<EnvironmentBindingRecord>();

    internal DbSet<WorkflowInstanceRecord> WorkflowInstances => Set<WorkflowInstanceRecord>();

    internal DbSet<WorkflowAuditEventRecord> WorkflowAuditEvents =>
        Set<WorkflowAuditEventRecord>();

    internal DbSet<SurveySubmissionRecord> SurveySubmissions => Set<SurveySubmissionRecord>();

    internal DbSet<ReviewTaskRecord> ReviewTasks => Set<ReviewTaskRecord>();

    internal DbSet<WorkflowResumeRecord> WorkflowResumes => Set<WorkflowResumeRecord>();

    internal DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    internal DbSet<ManagementAuditEventRecord> ManagementAuditEvents =>
        Set<ManagementAuditEventRecord>();

    internal DbSet<OutboxMessageRecord> OutboxMessages => Set<OutboxMessageRecord>();

    internal DbSet<ScheduledActionRecord> ScheduledActions => Set<ScheduledActionRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureManagedDefinitions(modelBuilder);
        ConfigureDefinitionDrafts(modelBuilder);
        ConfigureDefinitionRevisions(modelBuilder);
        ConfigureDefinitionReleases(modelBuilder);
        ConfigureDefinitionReleaseProvenance(modelBuilder);
        ConfigureEnvironments(modelBuilder);
        ConfigureActivations(modelBuilder);
        ConfigureEnvironmentBindings(modelBuilder);
        ConfigureWorkflowInstances(modelBuilder);
        ConfigureSurveySubmissions(modelBuilder);
        ConfigureReviewTasks(modelBuilder);
        ConfigureWorkflowResumes(modelBuilder);
        ConfigureAuditEvents(modelBuilder);
        ConfigureIdempotency(modelBuilder);
        ConfigureManagementAuditEvents(modelBuilder);
        ConfigureOutbox(modelBuilder);
        ConfigureScheduledActions(modelBuilder);
    }

    private static void ConfigureManagedDefinitions(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ManagedDefinitionRecord>();
        _ = entity.ToTable("managed_definitions");
        _ = entity.HasKey(record => new { record.TenantId, record.Name });
        _ = entity.Property(record => record.Name).HasMaxLength(128);
    }

    private static void ConfigureDefinitionDrafts(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<DefinitionDraftRecord>();
        _ = entity.ToTable("definition_drafts");
        _ = entity.HasKey(record => new { record.TenantId, record.ManagedDefinitionName });
        _ = entity.Property(record => record.DefinitionJson).HasColumnType("jsonb");
        _ = entity.Property(record => record.DefinitionDigest).HasMaxLength(71);
        _ = entity.Property(record => record.Version).IsConcurrencyToken();
        _ = entity.HasOne<ManagedDefinitionRecord>().WithOne()
            .HasForeignKey<DefinitionDraftRecord>(record => new
            {
                record.TenantId,
                Name = record.ManagedDefinitionName,
            }).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureDefinitionRevisions(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<DefinitionRevisionRecord>();
        _ = entity.ToTable("definition_revisions");
        _ = entity.HasKey(record => new
        {
            record.TenantId,
            record.ManagedDefinitionName,
            record.Number,
        });
        _ = entity.HasIndex(record => new
        {
            record.TenantId,
            record.ManagedDefinitionName,
            record.SourceDraftVersion,
        }).IsUnique();
        _ = entity.Property(record => record.DefinitionJson).HasColumnType("jsonb");
        _ = entity.Property(record => record.DefinitionDigest).HasMaxLength(71);
        _ = entity.HasOne<ManagedDefinitionRecord>().WithMany()
            .HasForeignKey(record => new
            {
                record.TenantId,
                Name = record.ManagedDefinitionName,
            }).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureDefinitionReleases(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<DefinitionReleaseRecord>();
        _ = entity.ToTable("definition_releases");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasAlternateKey(record => new { record.TenantId, record.Digest });
        _ = entity.HasIndex(record => new
        {
            record.TenantId,
            record.ManagedDefinitionName,
            record.VersionLabel,
        }).IsUnique();
        _ = entity.Property(record => record.WorkflowJson).HasColumnType("jsonb");
        _ = entity.Property(record => record.SurveyDefinitionsJson).HasColumnType("jsonb");
        _ = entity.Property(record => record.Digest).HasMaxLength(71);
        _ = entity.Property(record => record.ManagedDefinitionName).HasMaxLength(128);
        _ = entity.Property(record => record.VersionLabel).HasMaxLength(128);
    }

    private static void ConfigureDefinitionReleaseProvenance(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<DefinitionReleaseProvenanceRecord>();
        _ = entity.ToTable("definition_release_provenance");
        _ = entity.HasKey(record => new
        {
            record.TenantId,
            record.ReleaseDigest,
            record.ManagedDefinitionName,
            record.RevisionNumber,
        });
        _ = entity.HasOne<DefinitionReleaseRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Digest = record.ReleaseDigest })
            .HasPrincipalKey(record => new { record.TenantId, record.Digest })
            .OnDelete(DeleteBehavior.Restrict);
        _ = entity.HasOne<DefinitionRevisionRecord>().WithMany()
            .HasForeignKey(record => new
            {
                record.TenantId,
                record.ManagedDefinitionName,
                Number = record.RevisionNumber,
            }).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureActivations(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ActivationRecord>();
        _ = entity.ToTable("activations");
        _ = entity.HasKey(record => new
        {
            record.TenantId,
            record.EnvironmentName,
            record.ManagedDefinitionName,
        });
        _ = entity.Property(record => record.Version).IsConcurrencyToken();
        _ = entity.HasOne<DefinitionReleaseRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Digest = record.ReleaseDigest })
            .HasPrincipalKey(record => new { record.TenantId, record.Digest })
            .OnDelete(DeleteBehavior.Restrict);
        _ = entity.HasOne<EnvironmentRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Name = record.EnvironmentName })
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureEnvironments(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<EnvironmentRecord>();
        _ = entity.ToTable("environments");
        _ = entity.HasKey(record => new { record.TenantId, record.Name });
        _ = entity.HasIndex(record => new { record.TenantId, record.Position, record.Name });
        _ = entity.Property(record => record.Name).HasMaxLength(128);
        _ = entity.Property(record => record.DisplayName).HasMaxLength(128);
        _ = entity.Property(record => record.Version).IsConcurrencyToken();
    }

    private static void ConfigureEnvironmentBindings(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<EnvironmentBindingRecord>();
        _ = entity.ToTable("environment_bindings");
        _ = entity.HasKey(record => new
        {
            record.TenantId,
            record.EnvironmentName,
            record.Name,
        });
        _ = entity.Property(record => record.Name).HasMaxLength(128);
        _ = entity.Property(record => record.Reference).HasMaxLength(2048);
        _ = entity.Property(record => record.Version).IsConcurrencyToken();
        _ = entity.HasOne<EnvironmentRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Name = record.EnvironmentName })
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureAuditEvents(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowAuditEventRecord>();
        _ = entity.ToTable("workflow_audit_events");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new
        {
            record.TenantId,
            record.WorkflowInstanceId,
            record.Sequence,
        }).IsUnique();
        _ = entity.Property(record => record.PayloadJson).HasColumnType("jsonb");
    }

    private static void ConfigureIdempotency(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<IdempotencyRecord>();
        _ = entity.ToTable("idempotency_records");
        _ = entity.HasKey(record => new { record.TenantId, record.Key });
        _ = entity.Property(record => record.ResultJson).HasColumnType("jsonb");
        _ = entity.Property(record => record.Key).HasMaxLength(128);
        _ = entity.Property(record => record.RequestHash).HasMaxLength(71);
    }

    private static void ConfigureManagementAuditEvents(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ManagementAuditEventRecord>();
        _ = entity.ToTable("management_audit_events");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new { record.TenantId, record.Subject, record.OccurredAt });
        _ = entity.Property(record => record.PayloadJson).HasColumnType("jsonb");
    }

    private static void ConfigureOutbox(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<OutboxMessageRecord>();
        _ = entity.ToTable("outbox_messages");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new { record.TenantId, record.EffectId }).IsUnique();
        _ = entity.HasIndex(record => new { record.Status, record.AvailableAt });
        _ = entity.Property(record => record.PayloadJson).HasColumnType("jsonb");
        _ = entity.Property(record => record.LastError).HasMaxLength(2048);
    }

    private static void ConfigureScheduledActions(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ScheduledActionRecord>();
        _ = entity.ToTable("scheduled_actions");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new { record.TenantId, record.ActionId }).IsUnique();
        _ = entity.HasIndex(record => new { record.Status, record.DueAt });
        _ = entity.Property(record => record.LastError).HasMaxLength(2048);
    }
}
