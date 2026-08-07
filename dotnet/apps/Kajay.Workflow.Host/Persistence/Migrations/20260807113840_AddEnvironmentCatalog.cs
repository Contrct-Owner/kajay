using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kajay.Workflow.Host.Persistence.Migrations;

/// <inheritdoc />
public partial class AddEnvironmentCatalog : Migration
{
    private static readonly string[] EnvironmentKey = ["TenantId", "Name"];
    private static readonly string[] EnvironmentForeignKey = ["TenantId", "EnvironmentName"];
    private static readonly string[] EnvironmentPositionIndex = ["TenantId", "Position", "Name"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "EnvironmentName",
            table: "workflow_instances",
            type: "character varying(128)",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");

        migrationBuilder.AlterColumn<string>(
            name: "EnvironmentName",
            table: "environment_bindings",
            type: "character varying(128)",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");

        migrationBuilder.AlterColumn<string>(
            name: "Reference",
            table: "environment_bindings",
            type: "character varying(2048)",
            maxLength: 2048,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");

        migrationBuilder.AlterColumn<string>(
            name: "Name",
            table: "environment_bindings",
            type: "character varying(128)",
            maxLength: 128,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");

        migrationBuilder.AddColumn<string>(
            name: "UpdatedBy",
            table: "environment_bindings",
            type: "text",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<long>(
            name: "Version",
            table: "environment_bindings",
            type: "bigint",
            nullable: false,
            defaultValue: 0L);

        migrationBuilder.AlterColumn<string>(
            name: "EnvironmentName",
            table: "activations",
            type: "character varying(128)",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");

        migrationBuilder.CreateTable(
            name: "environments",
            columns: table => new
            {
                TenantId = table.Column<string>(type: "text", nullable: false),
                Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                DisplayName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                RequiresApproval = table.Column<bool>(type: "boolean", nullable: false),
                Position = table.Column<int>(type: "integer", nullable: false),
                Version = table.Column<long>(type: "bigint", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedBy = table.Column<string>(type: "text", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_environments", x => new { x.TenantId, x.Name });
            });

        migrationBuilder.CreateIndex(
            name: "IX_workflow_instances_TenantId_EnvironmentName",
            table: "workflow_instances",
            columns: EnvironmentForeignKey);

        migrationBuilder.CreateIndex(
            name: "IX_environments_TenantId_Position_Name",
            table: "environments",
            columns: EnvironmentPositionIndex);

        migrationBuilder.Sql("""
                WITH tenants AS (
                    SELECT "TenantId" FROM "managed_definitions"
                    UNION SELECT "TenantId" FROM "definition_releases"
                    UNION SELECT "TenantId" FROM "activations"
                    UNION SELECT "TenantId" FROM "environment_bindings"
                    UNION SELECT "TenantId" FROM "workflow_instances"
                ), defaults("Name", "DisplayName", "RequiresApproval", "Position") AS (
                    VALUES
                        ('development', 'Development', FALSE, 100),
                        ('test', 'Test', FALSE, 200),
                        ('staging', 'Staging', FALSE, 300),
                        ('production', 'Production', TRUE, 400)
                )
                INSERT INTO "environments"
                    ("TenantId", "Name", "DisplayName", "RequiresApproval", "Position",
                     "Version", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt")
                SELECT tenants."TenantId", defaults."Name", defaults."DisplayName",
                       defaults."RequiresApproval", defaults."Position", 1,
                       'migration', CURRENT_TIMESTAMP, 'migration', CURRENT_TIMESTAMP
                FROM tenants CROSS JOIN defaults
                ON CONFLICT DO NOTHING;

                WITH legacy AS (
                    SELECT "TenantId", "EnvironmentName" AS "Name" FROM "activations"
                    UNION SELECT "TenantId", "EnvironmentName" FROM "environment_bindings"
                    UNION SELECT "TenantId", "EnvironmentName" FROM "workflow_instances"
                )
                INSERT INTO "environments"
                    ("TenantId", "Name", "DisplayName", "RequiresApproval", "Position",
                     "Version", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt")
                SELECT legacy."TenantId", legacy."Name",
                       initcap(replace(legacy."Name", '-', ' ')), FALSE, 1000, 1,
                       'migration', CURRENT_TIMESTAMP, 'migration', CURRENT_TIMESTAMP
                FROM legacy
                ON CONFLICT DO NOTHING;

                UPDATE "environment_bindings"
                SET "Version" = 1, "UpdatedBy" = 'migration';
                ALTER TABLE "environment_bindings" ALTER COLUMN "Version" DROP DEFAULT;
                ALTER TABLE "environment_bindings" ALTER COLUMN "UpdatedBy" DROP DEFAULT;
                """);

        migrationBuilder.AddForeignKey(
            name: "FK_activations_environments_TenantId_EnvironmentName",
            table: "activations",
            columns: EnvironmentForeignKey,
            principalTable: "environments",
            principalColumns: EnvironmentKey,
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_environment_bindings_environments_TenantId_EnvironmentName",
            table: "environment_bindings",
            columns: EnvironmentForeignKey,
            principalTable: "environments",
            principalColumns: EnvironmentKey,
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_workflow_instances_environments_TenantId_EnvironmentName",
            table: "workflow_instances",
            columns: EnvironmentForeignKey,
            principalTable: "environments",
            principalColumns: EnvironmentKey,
            onDelete: ReferentialAction.Restrict);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_activations_environments_TenantId_EnvironmentName",
            table: "activations");

        migrationBuilder.DropForeignKey(
            name: "FK_environment_bindings_environments_TenantId_EnvironmentName",
            table: "environment_bindings");

        migrationBuilder.DropForeignKey(
            name: "FK_workflow_instances_environments_TenantId_EnvironmentName",
            table: "workflow_instances");

        migrationBuilder.DropTable(
            name: "environments");

        migrationBuilder.DropIndex(
            name: "IX_workflow_instances_TenantId_EnvironmentName",
            table: "workflow_instances");

        migrationBuilder.DropColumn(
            name: "UpdatedBy",
            table: "environment_bindings");

        migrationBuilder.DropColumn(
            name: "Version",
            table: "environment_bindings");

        migrationBuilder.AlterColumn<string>(
            name: "EnvironmentName",
            table: "workflow_instances",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(128)");

        migrationBuilder.AlterColumn<string>(
            name: "EnvironmentName",
            table: "environment_bindings",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(128)");

        migrationBuilder.AlterColumn<string>(
            name: "Reference",
            table: "environment_bindings",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(2048)",
            oldMaxLength: 2048);

        migrationBuilder.AlterColumn<string>(
            name: "Name",
            table: "environment_bindings",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(128)",
            oldMaxLength: 128);

        migrationBuilder.AlterColumn<string>(
            name: "EnvironmentName",
            table: "activations",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(128)");
    }
}
