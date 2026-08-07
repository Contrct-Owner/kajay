using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kajay.Workflow.Host.Persistence.Migrations;

/// <inheritdoc />
public partial class AddSurveySubmissions : Migration
{
    private static readonly string[] WorkflowInstanceKey = ["TenantId", "Id"];
    private static readonly string[] SubmissionAttemptIndex =
        ["TenantId", "WorkflowInstanceId", "StepKey", "AttemptNumber"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "survey_submissions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<string>(type: "text", nullable: false),
                WorkflowInstanceId = table.Column<Guid>(type: "uuid", nullable: false),
                StepKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                DefinitionDigest = table.Column<string>(type: "character varying(71)", maxLength: 71, nullable: false),
                SnapshotJson = table.Column<string>(type: "jsonb", nullable: false),
                SubmittedBy = table.Column<string>(type: "text", nullable: false),
                SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_survey_submissions", x => x.Id);
                table.ForeignKey(
                    name: "FK_survey_submissions_workflow_instances_TenantId_WorkflowInst~",
                    columns: x => new { x.TenantId, x.WorkflowInstanceId },
                    principalTable: "workflow_instances",
                    principalColumns: WorkflowInstanceKey,
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_survey_submissions_TenantId_WorkflowInstanceId_StepKey_Atte~",
            table: "survey_submissions",
            columns: SubmissionAttemptIndex,
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "survey_submissions");
    }
}
