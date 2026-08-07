using Microsoft.EntityFrameworkCore;

namespace Kajay.Workflow.Host.Persistence;

internal sealed partial class WorkflowDbContext
{
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
        _ = entity.HasOne<EnvironmentRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Name = record.EnvironmentName })
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureSurveySubmissions(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<SurveySubmissionRecord>();
        _ = entity.ToTable("survey_submissions");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new
        {
            record.TenantId,
            record.WorkflowInstanceId,
            record.StepKey,
            record.AttemptNumber,
        }).IsUnique();
        _ = entity.Property(record => record.StepKey).HasMaxLength(128);
        _ = entity.Property(record => record.DefinitionDigest).HasMaxLength(71);
        _ = entity.Property(record => record.SnapshotJson).HasColumnType("jsonb");
        _ = entity.HasOne<WorkflowInstanceRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Id = record.WorkflowInstanceId })
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureWorkflowResumes(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowResumeRecord>();
        _ = entity.ToTable("workflow_resumes");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new { record.TenantId, record.DispatchId }).IsUnique();
        _ = entity.HasIndex(record => new { record.Status, record.AvailableAt });
        _ = entity.Property(record => record.DispatchId).HasMaxLength(256);
        _ = entity.Property(record => record.Kind).HasMaxLength(32);
        _ = entity.Property(record => record.StepKey).HasMaxLength(128);
        _ = entity.Property(record => record.LastError).HasMaxLength(2048);
        _ = entity.HasOne<WorkflowInstanceRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Id = record.WorkflowInstanceId })
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureReviewTasks(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ReviewTaskRecord>();
        _ = entity.ToTable("review_tasks");
        _ = entity.HasKey(record => record.Id);
        _ = entity.HasIndex(record => new
        {
            record.TenantId,
            record.WorkflowInstanceId,
            record.StepKey,
            record.RoundNumber,
        }).IsUnique();
        _ = entity.HasIndex(record => new
        {
            record.TenantId,
            record.AssignedPermission,
            record.Status,
            record.CreatedAt,
        });
        _ = entity.Property(record => record.StepKey).HasMaxLength(128);
        _ = entity.Property(record => record.AssignedPermission).HasMaxLength(128);
        _ = entity.Property(record => record.Status).HasMaxLength(32);
        _ = entity.Property(record => record.Comment).HasMaxLength(2000);
        _ = entity.HasOne<WorkflowInstanceRecord>().WithMany()
            .HasForeignKey(record => new { record.TenantId, Id = record.WorkflowInstanceId })
            .OnDelete(DeleteBehavior.Restrict);
        _ = entity.HasOne<SurveySubmissionRecord>().WithMany()
            .HasForeignKey(record => record.SubmissionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
