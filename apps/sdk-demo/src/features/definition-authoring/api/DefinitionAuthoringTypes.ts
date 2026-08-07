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
  readonly canRollback: boolean;
}

export interface ManagementAuditEvent {
  readonly id: string;
  readonly subject: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface DefinitionProvenance {
  readonly managedDefinitionName: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly environmentName: string;
  readonly environments: readonly string[];
  readonly activation: DefinitionActivationState;
  readonly revisions: readonly DefinitionRevisionHistory[];
  readonly releases: readonly DefinitionReleaseHistory[];
  readonly auditEvents: readonly ManagementAuditEvent[];
}
