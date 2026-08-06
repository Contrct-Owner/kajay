using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Persistence;

internal sealed class WorkflowDbContext(DbContextOptions<WorkflowDbContext> options)
    : DbContext(options)
{
    internal DbSet<DefinitionReleaseRecord> DefinitionReleases => Set<DefinitionReleaseRecord>();

    internal DbSet<ActivationRecord> Activations => Set<ActivationRecord>();

    internal DbSet<EnvironmentBindingRecord> EnvironmentBindings =>
        Set<EnvironmentBindingRecord>();

    internal DbSet<WorkflowInstanceRecord> WorkflowInstances => Set<WorkflowInstanceRecord>();

    internal DbSet<WorkflowAuditEventRecord> WorkflowAuditEvents =>
        Set<WorkflowAuditEventRecord>();

    internal DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    internal DbSet<ManagementAuditEventRecord> ManagementAuditEvents =>
        Set<ManagementAuditEventRecord>();

    internal DbSet<OutboxMessageRecord> OutboxMessages => Set<OutboxMessageRecord>();

    internal DbSet<ScheduledActionRecord> ScheduledActions => Set<ScheduledActionRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureDefinitionReleases(modelBuilder);
        ConfigureActivations(modelBuilder);
        ConfigureEnvironmentBindings(modelBuilder);
        ConfigureWorkflowInstances(modelBuilder);
        ConfigureAuditEvents(modelBuilder);
        ConfigureIdempotency(modelBuilder);
        ConfigureManagementAuditEvents(modelBuilder);
        ConfigureOutbox(modelBuilder);
        ConfigureScheduledActions(modelBuilder);
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
    }

    private static void ConfigureWorkflowInstances(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowInstanceRecord>();
        _ = entity.ToTable("workflow_instances");
        _ = entity.HasKey(record => new { record.TenantId, record.Id });
        _ = entity.Property(record => record.Version).IsConcurrencyToken();
        _ = entity.Property(record => record.ResponseSnapshotJson).HasColumnType("jsonb");
        _ = entity.HasIndex(record => new { record.TenantId, record.Status, record.UpdatedAt });
        _ = entity.HasOne<DefinitionReleaseRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Digest = record.ReleaseDigest })
            .HasPrincipalKey(record => new { record.TenantId, record.Digest })
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
