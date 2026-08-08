import type { SurveyDefinition, SurveySnapshot } from '@kajay/core';

export type ReviewTaskStatus = 'pending' | 'approved' | 'denied' | 'changes-requested';
export type ReviewDecision = 'approve' | 'deny' | 'request-changes';
export type ReviewQueueStatus = 'pending' | 'completed';

export interface ReviewTask {
  readonly id: string;
  readonly workflowInstanceId: string;
  readonly submissionId: string;
  readonly stepKey: string;
  readonly roundNumber: number;
  readonly assignedPermission: string;
  readonly status: ReviewTaskStatus;
  readonly createdAt: string;
  readonly decidedBy: string | undefined;
  readonly decidedAt: string | undefined;
  readonly comment: string | undefined;
}

export interface ReviewQueueItem {
  readonly task: ReviewTask;
  readonly environmentName: string;
  readonly managedDefinitionName: string;
  readonly releaseDigest: string;
  readonly workflowStatus: string;
  readonly activeStepKey: string;
  readonly workflowVersion: number;
}

export interface ReviewQueuePage {
  readonly items: readonly ReviewQueueItem[];
  readonly nextCursor: string | undefined;
}

export interface WorkflowInstance {
  readonly id: string;
  readonly environmentName: string;
  readonly managedDefinitionName: string;
  readonly releaseDigest: string;
  readonly status: string;
  readonly activeStepKey: string;
  readonly version: number;
}

export interface SurveySubmission {
  readonly id: string;
  readonly workflowInstanceId: string;
  readonly stepKey: string;
  readonly attemptNumber: number;
  readonly definitionDigest: string;
  readonly snapshot: SurveySnapshot;
  readonly submittedBy: string;
  readonly submittedAt: string;
}

export interface WorkflowAuditEvent {
  readonly sequence: number;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface ReviewTaskDetail {
  readonly task: ReviewTask;
  readonly instance: WorkflowInstance;
  readonly submission: SurveySubmission;
  readonly definition: SurveyDefinition;
  readonly reviewRounds: readonly ReviewTask[];
  readonly reviewRoundsTruncated: boolean;
  readonly auditHistory: readonly WorkflowAuditEvent[];
  readonly auditHistoryTruncated: boolean;
}

export interface ReviewQueueRequest {
  readonly status: ReviewQueueStatus;
  readonly managedDefinitionName?: string | undefined;
  readonly createdAfter?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

export interface ReviewDecisionInput {
  readonly decision: ReviewDecision;
  readonly comment?: string | undefined;
}
