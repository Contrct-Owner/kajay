using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kajay.Workflow.Host.Persistence.Migrations;

/// <inheritdoc />
public partial class AddWorkflowResumeDispatch : Migration
{
    private static readonly string[] WorkflowInstanceKey = ["TenantId", "Id"];
    private static readonly string[] WorkflowInstanceForeignKey =
        ["TenantId", "WorkflowInstanceId"];
    private static readonly string[] StatusIndex = ["Status", "AvailableAt"];
    private static readonly string[] DispatchIndex = ["TenantId", "DispatchId"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
                name: "workflow_resumes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    WorkflowInstanceId = table.Column<Guid>(type: "uuid", nullable: false),
                    DispatchId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    StepKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    AvailableAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LeaseToken = table.Column<Guid>(type: "uuid", nullable: true),
                    LeaseUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_resumes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_workflow_resumes_workflow_instances_TenantId_WorkflowInstan~",
                        columns: x => new { x.TenantId, x.WorkflowInstanceId },
                        principalTable: "workflow_instances",
                        principalColumns: WorkflowInstanceKey,
                        onDelete: ReferentialAction.Restrict);
                });

        migrationBuilder.CreateIndex(
                name: "IX_workflow_resumes_Status_AvailableAt",
                table: "workflow_resumes",
                columns: StatusIndex);

        migrationBuilder.CreateIndex(
                name: "IX_workflow_resumes_TenantId_DispatchId",
                table: "workflow_resumes",
                columns: DispatchIndex,
                unique: true);

        migrationBuilder.CreateIndex(
                name: "IX_workflow_resumes_TenantId_WorkflowInstanceId",
                table: "workflow_resumes",
                columns: WorkflowInstanceForeignKey);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "workflow_resumes");
    }
}
