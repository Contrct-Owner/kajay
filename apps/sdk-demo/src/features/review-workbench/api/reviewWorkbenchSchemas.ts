import { parseSurveySnapshot } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import type {
  ReviewQueueItem,
  ReviewQueuePage,
  ReviewTask,
  ReviewTaskDetail,
  ReviewTaskStatus,
  SurveySubmission,
  WorkflowAuditEvent,
  WorkflowInstance,
} from './ReviewWorkbenchTypes.js';

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, name: string): string | undefined {
  return value === null || value === undefined ? undefined : string(value, name);
}

function integer(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer.`);
  }
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean.`);
  return value;
}

function array<T>(value: unknown, name: string, read: (item: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array.`);
  return value.map((item) => read(item));
}

function readStatus(value: unknown): ReviewTaskStatus {
  return value === 'pending' || value === 'approved' || value === 'denied'
    || value === 'changes-requested'
    ? value
    : (() => { throw new TypeError('Review Task status is invalid.'); })();
}

export function readReviewTask(value: unknown): ReviewTask {
  const source = object(value, 'Review Task');
  return {
    id: string(source['id'], 'Review Task id'),
    workflowInstanceId: string(source['workflowInstanceId'], 'Workflow Instance id'),
    submissionId: string(source['submissionId'], 'Submission id'),
    stepKey: string(source['stepKey'], 'Review step key'),
    roundNumber: integer(source['roundNumber'], 'Review round number'),
    assignedPermission: string(source['assignedPermission'], 'Assigned permission'),
    status: readStatus(source['status']),
    createdAt: string(source['createdAt'], 'Review createdAt'),
    decidedBy: optionalString(source['decidedBy'], 'Review decidedBy'),
    decidedAt: optionalString(source['decidedAt'], 'Review decidedAt'),
    comment: optionalString(source['comment'], 'Review comment'),
  };
}

function readQueueItem(value: unknown): ReviewQueueItem {
  const source = object(value, 'Review queue item');
  return {
    task: readReviewTask(source['task']),
    environmentName: string(source['environmentName'], 'Environment name'),
    managedDefinitionName: string(source['managedDefinitionName'], 'Managed Definition name'),
    releaseDigest: string(source['releaseDigest'], 'Release digest'),
    workflowStatus: string(source['workflowStatus'], 'Workflow status'),
    activeStepKey: string(source['activeStepKey'], 'Active step key'),
    workflowVersion: integer(source['workflowVersion'], 'Workflow version'),
  };
}

export function readReviewQueuePage(value: unknown): ReviewQueuePage {
  const source = object(value, 'Review queue page');
  return {
    items: array(source['items'], 'Review queue items', readQueueItem),
    nextCursor: optionalString(source['nextCursor'], 'Review queue cursor'),
  };
}

function readInstance(value: unknown): WorkflowInstance {
  const source = object(value, 'Workflow Instance');
  return {
    id: string(source['id'], 'Workflow Instance id'),
    environmentName: string(source['environmentName'], 'Environment name'),
    managedDefinitionName: string(source['managedDefinitionName'], 'Managed Definition name'),
    releaseDigest: string(source['releaseDigest'], 'Release digest'),
    status: string(source['status'], 'Workflow status'),
    activeStepKey: string(source['activeStepKey'], 'Active step key'),
    version: integer(source['version'], 'Workflow version'),
  };
}

function readSubmission(value: unknown): SurveySubmission {
  const source = object(value, 'Survey Submission');
  return {
    id: string(source['id'], 'Submission id'),
    workflowInstanceId: string(source['workflowInstanceId'], 'Workflow Instance id'),
    stepKey: string(source['stepKey'], 'Submission step key'),
    attemptNumber: integer(source['attemptNumber'], 'Attempt number'),
    definitionDigest: string(source['definitionDigest'], 'Definition digest'),
    snapshot: parseSurveySnapshot(JSON.stringify(source['snapshot'])),
    submittedBy: string(source['submittedBy'], 'Submission actor'),
    submittedAt: string(source['submittedAt'], 'Submission date'),
  };
}

function readAudit(value: unknown): WorkflowAuditEvent {
  const source = object(value, 'Workflow Audit Event');
  return {
    sequence: integer(source['sequence'], 'Audit sequence'),
    eventType: string(source['eventType'], 'Audit event type'),
    payload: object(source['payload'], 'Audit payload'),
    actorId: string(source['actorId'], 'Audit actor'),
    occurredAt: string(source['occurredAt'], 'Audit date'),
  };
}

export function readReviewTaskDetail(value: unknown): ReviewTaskDetail {
  const source = object(value, 'Review Task detail');
  return {
    task: readReviewTask(source['task']),
    instance: readInstance(source['instance']),
    submission: readSubmission(source['submission']),
    definition: object(source['definition'], 'Survey Definition') as SurveyDefinition,
    reviewRounds: array(source['reviewRounds'], 'Review rounds', readReviewTask),
    reviewRoundsTruncated: boolean(source['reviewRoundsTruncated'], 'Review rounds truncated'),
    auditHistory: array(source['auditHistory'], 'Workflow audit history', readAudit),
    auditHistoryTruncated: boolean(source['auditHistoryTruncated'], 'Audit history truncated'),
  };
}

export function readProblemDetail(value: unknown): string | undefined {
  const source = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
  return typeof source?.['detail'] === 'string' ? source['detail'] : undefined;
}
