import { useCallback, useMemo, useState } from 'react';
import { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import type {
  DefinitionProvenance,
  ReleasePreflight,
} from '../api/DefinitionAuthoringTypes.js';
import { useDefinitionProvenanceQuery } from './useDefinitionProvenanceQuery.js';
import { useDefinitionRollback } from './useDefinitionRollback.js';
import { useReleasePreflight } from './useReleasePreflight.js';

export interface DefinitionProvenanceState {
  readonly environmentName: string;
  readonly provenance: DefinitionProvenance | undefined;
  readonly error: string | undefined;
  readonly isLoading: boolean;
  readonly isWorking: boolean;
  readonly needsLogin: boolean;
  readonly preflight: ReleasePreflight | undefined;
  readonly selectEnvironment: (name: string) => void;
  readonly refresh: () => void;
  readonly activate: (releaseDigest: string) => Promise<void>;
  readonly runPreflight: (releaseDigest: string) => Promise<void>;
}

export function useDefinitionProvenance(
  managedName: string,
  refreshSignal: string,
): DefinitionProvenanceState {
  const client = useMemo(() => new DefinitionAuthoringClient(), []);
  const [environmentName, setEnvironmentName] = useState('test');
  const query = useDefinitionProvenanceQuery(
    client, managedName, environmentName, refreshSignal,
  );
  const rollbackState = useDefinitionRollback(
    client, managedName, environmentName, query.refresh,
  );
  const preflightState = useReleasePreflight(client, environmentName);

  const selectEnvironment = useCallback((name: string): void => {
    const selected = name.trim();
    if (selected.length === 0 || selected.length > 128) {
      return;
    }
    preflightState.clear();
    setEnvironmentName(selected);
  }, [preflightState]);

  const activate = useCallback(async (releaseDigest: string): Promise<void> => {
    if (query.provenance === undefined) return;
    await rollbackState.activate(releaseDigest, query.provenance.activation.version);
  }, [query.provenance, rollbackState]);

  return {
    environmentName,
    provenance: query.provenance,
    error: rollbackState.error ?? preflightState.error ?? query.error,
    isLoading: query.isLoading,
    isWorking: rollbackState.isWorking || preflightState.isWorking,
    needsLogin: rollbackState.needsLogin || preflightState.needsLogin || query.needsLogin,
    preflight: preflightState.result,
    selectEnvironment,
    refresh: query.refresh,
    activate,
    runPreflight: preflightState.run,
  };
}
