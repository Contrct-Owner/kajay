using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kajay.Workflow.Host.Persistence.Migrations;

/// <inheritdoc />
public partial class AddHumanReview : Migration
{
    private static readonly string[] WorkflowInstanceKey = ["TenantId", "Id"];
    private static readonly string[] AssignmentIndex =
        ["TenantId", "AssignedPermission", "Status", "CreatedAt"];
    private static readonly string[] RoundIndex =
        ["TenantId", "WorkflowInstanceId", "StepKey", "RoundNumber"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "ReviewTaskId",
            table: "workflow_resumes",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "review_tasks",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<string>(type: "text", nullable: false),
                WorkflowInstanceId = table.Column<Guid>(type: "uuid", nullable: false),
                SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                StepKey = table.Column<string>(
                    type: "character varying(128)", maxLength: 128, nullable: false),
                RoundNumber = table.Column<int>(type: "integer", nullable: false),
                AssignedPermission = table.Column<string>(
                    type: "character varying(128)", maxLength: 128, nullable: false),
                Status = table.Column<string>(
                    type: "character varying(32)", maxLength: 32, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                DecidedBy = table.Column<string>(type: "text", nullable: true),
                DecidedAt = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true),
                Comment = table.Column<string>(
                    type: "character varying(2000)", maxLength: 2000, nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_review_tasks", value => value.Id);
                table.ForeignKey(
                    name: "FK_review_tasks_survey_submissions_SubmissionId",
                    column: value => value.SubmissionId,
                    principalTable: "survey_submissions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_review_tasks_workflow_instances_TenantId_WorkflowInstanceId",
                    columns: value => new { value.TenantId, value.WorkflowInstanceId },
                    principalTable: "workflow_instances",
                    principalColumns: WorkflowInstanceKey,
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_review_tasks_SubmissionId",
            table: "review_tasks",
            column: "SubmissionId");
        migrationBuilder.CreateIndex(
            name: "IX_review_tasks_TenantId_AssignedPermission_Status_CreatedAt",
            table: "review_tasks",
            columns: AssignmentIndex);
        migrationBuilder.CreateIndex(
            name: "IX_review_tasks_TenantId_WorkflowInstanceId_StepKey_RoundNumber",
            table: "review_tasks",
            columns: RoundIndex,
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "review_tasks");
        migrationBuilder.DropColumn(name: "ReviewTaskId", table: "workflow_resumes");
    }
}
