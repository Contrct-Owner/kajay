import type { SurveyDefinition } from '@kajay/core';

export interface DefinitionDraft {
  readonly managedDefinitionName: string;
  readonly definition: SurveyDefinition;
  readonly definitionDigest: string;
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly created: boolean;
}

export interface DefinitionRevision {
  readonly managedDefinitionName: string;
  readonly number: number;
  readonly sourceDraftVersion: number;
  readonly definitionDigest: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly created: boolean;
}

export interface DefinitionRelease {
  readonly digest: string;
  readonly managedDefinitionName: string;
  readonly versionLabel: string;
  readonly installed: boolean;
}

export type PromotionStatus = 'active' | 'ready' | 'blocked';

export interface DefinitionActivationState {
  readonly version: number;
  readonly releaseDigest: string | undefined;
  readonly versionLabel: string | undefined;
  readonly activatedBy: string | undefined;
  readonly approvedBy: string | undefined;
  readonly activatedAt: string | undefined;
}

export interface DefinitionRevisionHistory {
  readonly number: number;
  readonly sourceDraftVersion: number;
  readonly definitionDigest: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly releaseDigests: readonly string[];
}

export interface DefinitionReleaseHistory {
  readonly digest: string;
  readonly versionLabel: string;
  readonly conformanceVersion: number;
  readonly installedAt: string;
  readonly sourceRevisionNumbers: readonly number[];
  readonly requiredBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly promotionStatus: PromotionStatus;
  readonly canActivate: boolean;
  readonly canRollback: boolean;
}

export interface ReleasePreflight {
  readonly digest: string;
  readonly managedDefinitionName: string;
  readonly versionLabel: string;
  readonly compatible: boolean;
  readonly missingBindings: readonly string[];
  readonly requiresApproval: boolean;
}

export interface ManagedEnvironment {
  readonly name: string;
  readonly displayName: string;
  readonly requiresApproval: boolean;
  readonly position: number;
  readonly version: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface EnvironmentBinding {
  readonly environmentName: string;
  readonly name: string;
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface ManagementAuditEvent {
  readonly id: string;
  readonly subject: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | undefined;
}

export interface HistoryPageRequest {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly query?: string | undefined;
}

export interface ReleaseHistoryPageRequest extends HistoryPageRequest {
  readonly status?: PromotionStatus | undefined;
}

export type DefinitionReleaseChangeKind = 'added' | 'removed' | 'changed';
export type DefinitionReleaseChangeArea =
  'definition' | 'workflow' | 'bindings' | 'compatibility';

export interface DefinitionReleaseComparisonTarget {
  readonly digest: string;
  readonly versionLabel: string;
}

export interface DefinitionReleaseChangeSummary {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly total: number;
}

export interface DefinitionReleaseChange {
  readonly kind: DefinitionReleaseChangeKind;
  readonly area: DefinitionReleaseChangeArea;
  readonly path: string;
  readonly beforeValue: string | undefined;
  readonly afterValue: string | undefined;
}

export interface DefinitionReleaseComparison {
  readonly environmentName: string;
  readonly baseline: DefinitionReleaseComparisonTarget | undefined;
  readonly target: DefinitionReleaseComparisonTarget;
  readonly initialRelease: boolean;
  readonly summary: DefinitionReleaseChangeSummary;
  readonly changes: readonly DefinitionReleaseChange[];
  readonly truncated: boolean;
}

export interface DefinitionProvenance {
  readonly managedDefinitionName: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly environmentName: string;
  readonly environments: readonly string[];
  readonly activation: DefinitionActivationState;
  readonly revisions: CursorPage<DefinitionRevisionHistory>;
  readonly releases: CursorPage<DefinitionReleaseHistory>;
  readonly auditEvents: CursorPage<ManagementAuditEvent>;
}
