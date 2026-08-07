import { useCallback } from 'react';
import type { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import type {
  DefinitionProvenance,
  DefinitionReleaseHistory,
  DefinitionRevisionHistory,
  ManagementAuditEvent,
  PromotionStatus,
} from '../api/DefinitionAuthoringTypes.js';
import { useCursorPage } from './useCursorPage.js';
import type { CursorPageState } from './useCursorPage.js';

export interface HistoryFilters { readonly query: string }
export interface ReleaseHistoryFilters extends HistoryFilters {
  readonly status: PromotionStatus | undefined;
}

export interface DefinitionHistoryState {
  readonly revisions: CursorPageState<DefinitionRevisionHistory, HistoryFilters>;
  readonly releases: CursorPageState<DefinitionReleaseHistory, ReleaseHistoryFilters>;
  readonly auditEvents: CursorPageState<ManagementAuditEvent, HistoryFilters>;
}

const emptyFilters: HistoryFilters = { query: '' };
const emptyReleaseFilters: ReleaseHistoryFilters = { query: '', status: undefined };

export function useDefinitionHistory(
  client: DefinitionAuthoringClient,
  managedName: string,
  environmentName: string,
  provenance: DefinitionProvenance | undefined,
): DefinitionHistoryState {
  const revisionsLoader = useCallback((cursor: string | undefined, filters: HistoryFilters) =>
    client.getRevisions(managedName, { cursor, query: filters.query }), [client, managedName]);
  const releasesLoader = useCallback((cursor: string | undefined, filters: ReleaseHistoryFilters) =>
    client.getReleases(managedName, environmentName, {
      cursor, query: filters.query, status: filters.status,
    }), [client, environmentName, managedName]);
  const auditLoader = useCallback((cursor: string | undefined, filters: HistoryFilters) =>
    client.getAuditEvents(managedName, environmentName, {
      cursor, query: filters.query,
    }), [client, environmentName, managedName]);
  const key = `${managedName}:${environmentName}`;
  return {
    revisions: useCursorPage(key, provenance?.revisions, emptyFilters, revisionsLoader),
    releases: useCursorPage(key, provenance?.releases, emptyReleaseFilters, releasesLoader),
    auditEvents: useCursorPage(key, provenance?.auditEvents, emptyFilters, auditLoader),
  };
}
