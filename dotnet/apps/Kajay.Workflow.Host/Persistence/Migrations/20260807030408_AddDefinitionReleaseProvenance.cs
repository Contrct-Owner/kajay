using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kajay.Workflow.Host.Persistence.Migrations;

/// <inheritdoc />
public partial class AddDefinitionReleaseProvenance : Migration
{
    private static readonly string[] ReleasePrincipalColumns = ["TenantId", "Digest"];
    private static readonly string[] RevisionPrincipalColumns =
        ["TenantId", "ManagedDefinitionName", "Number"];
    private static readonly string[] RevisionIndexColumns =
        ["TenantId", "ManagedDefinitionName", "RevisionNumber"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
                name: "definition_release_provenance",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    ReleaseDigest = table.Column<string>(type: "character varying(71)", nullable: false),
                    ManagedDefinitionName = table.Column<string>(type: "character varying(128)", nullable: false),
                    RevisionNumber = table.Column<long>(type: "bigint", nullable: false),
                    LinkedBy = table.Column<string>(type: "text", nullable: false),
                    LinkedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_definition_release_provenance", x => new { x.TenantId, x.ReleaseDigest, x.ManagedDefinitionName, x.RevisionNumber });
                    table.ForeignKey(
                        name: "FK_definition_release_provenance_definition_releases_TenantId_~",
                        columns: x => new { x.TenantId, x.ReleaseDigest },
                        principalTable: "definition_releases",
                        principalColumns: ReleasePrincipalColumns,
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_definition_release_provenance_definition_revisions_TenantId~",
                        columns: x => new { x.TenantId, x.ManagedDefinitionName, x.RevisionNumber },
                        principalTable: "definition_revisions",
                        principalColumns: RevisionPrincipalColumns,
                        onDelete: ReferentialAction.Restrict);
                });

        migrationBuilder.CreateIndex(
            name: "IX_definition_release_provenance_TenantId_ManagedDefinitionNam~",
            table: "definition_release_provenance",
            columns: RevisionIndexColumns);

        migrationBuilder.Sql("""
                INSERT INTO "definition_release_provenance"
                    ("TenantId", "ReleaseDigest", "ManagedDefinitionName", "RevisionNumber",
                     "LinkedBy", "LinkedAt")
                SELECT audit."TenantId",
                       audit."Subject",
                       COALESCE(
                           audit."PayloadJson" ->> 'managedDefinitionName',
                           audit."PayloadJson" ->> 'ManagedDefinitionName'),
                       revision."Number",
                       audit."ActorId",
                       audit."OccurredAt"
                FROM "management_audit_events" AS audit
                INNER JOIN "definition_releases" AS release
                    ON release."TenantId" = audit."TenantId"
                    AND release."Digest" = audit."Subject"
                INNER JOIN "definition_revisions" AS revision
                    ON revision."TenantId" = audit."TenantId"
                    AND revision."ManagedDefinitionName" = COALESCE(
                        audit."PayloadJson" ->> 'managedDefinitionName',
                        audit."PayloadJson" ->> 'ManagedDefinitionName')
                    AND revision."Number" = CASE
                        WHEN (audit."PayloadJson" ->> 'revisionNumber') ~ '^[0-9]+$'
                        THEN (audit."PayloadJson" ->> 'revisionNumber')::bigint
                        ELSE NULL
                    END
                WHERE audit."EventType" = 'definition-release-created'
                    AND COALESCE(
                        audit."PayloadJson" ->> 'managedDefinitionName',
                        audit."PayloadJson" ->> 'ManagedDefinitionName') IS NOT NULL
                    AND (audit."PayloadJson" ->> 'revisionNumber') ~ '^[0-9]+$'
                ON CONFLICT DO NOTHING;
                """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "definition_release_provenance");
    }
}
