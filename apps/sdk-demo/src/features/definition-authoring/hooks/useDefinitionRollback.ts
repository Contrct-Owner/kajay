import { useCallback, useState } from 'react';
import type { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import { DefinitionAuthoringError } from '../api/DefinitionAuthoringError.js';

export interface DefinitionRollbackState {
  readonly error: string | undefined;
  readonly isWorking: boolean;
  readonly needsLogin: boolean;
  readonly rollback: (releaseDigest: string, expectedVersion: number) => Promise<void>;
}

export function useDefinitionRollback(
  client: DefinitionAuthoringClient,
  managedName: string,
  environmentName: string,
  refresh: () => void,
): DefinitionRollbackState {
  const [error, setError] = useState<string>();
  const [isWorking, setWorking] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const rollback = useCallback(async (
    releaseDigest: string,
    expectedVersion: number,
  ): Promise<void> => {
    setWorking(true);
    setError(undefined);
    try {
      await client.rollback(managedName, environmentName, releaseDigest, expectedVersion);
      setNeedsLogin(false);
    } catch (reason) {
      setNeedsLogin(reason instanceof DefinitionAuthoringError && reason.status === 401);
      setError(reason instanceof Error ? reason.message : 'Definition rollback failed.');
    } finally {
      setWorking(false);
      refresh();
    }
  }, [client, environmentName, managedName, refresh]);
  return { error, isWorking, needsLogin, rollback };
}
