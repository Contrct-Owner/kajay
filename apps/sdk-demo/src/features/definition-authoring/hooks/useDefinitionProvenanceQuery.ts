import { useEffect, useState } from 'react';
import type { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import { DefinitionAuthoringError } from '../api/DefinitionAuthoringError.js';
import type { DefinitionProvenance } from '../api/DefinitionAuthoringTypes.js';

export interface DefinitionProvenanceQuery {
  readonly provenance: DefinitionProvenance | undefined;
  readonly error: string | undefined;
  readonly isLoading: boolean;
  readonly needsLogin: boolean;
  readonly refreshVersion: number;
  readonly refresh: () => void;
}

export function useDefinitionProvenanceQuery(
  client: DefinitionAuthoringClient,
  managedName: string,
  environmentName: string,
  refreshSignal: string,
): DefinitionProvenanceQuery {
  const [provenance, setProvenance] = useState<DefinitionProvenance>();
  const [error, setError] = useState<string>();
  const [isLoading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void client.getProvenance(managedName, environmentName).then((value) => {
      if (!active) return;
      setProvenance(value);
      setError(undefined);
      setNeedsLogin(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setNeedsLogin(reason instanceof DefinitionAuthoringError && reason.status === 401);
      setError(readError(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, environmentName, managedName, refreshSignal, refreshVersion]);

  return {
    provenance,
    error,
    isLoading,
    needsLogin,
    refreshVersion,
    refresh: () => { setRefreshVersion((value) => value + 1); },
  };
}

function readError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Definition provenance failed.';
}
