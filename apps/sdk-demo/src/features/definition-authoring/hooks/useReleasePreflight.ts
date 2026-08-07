import { useCallback, useState } from 'react';
import type { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import { DefinitionAuthoringError } from '../api/DefinitionAuthoringError.js';
import type { ReleasePreflight } from '../api/DefinitionAuthoringTypes.js';

export interface ReleasePreflightState {
  readonly result: ReleasePreflight | undefined;
  readonly error: string | undefined;
  readonly isWorking: boolean;
  readonly needsLogin: boolean;
  readonly clear: () => void;
  readonly run: (releaseDigest: string) => Promise<void>;
}

export function useReleasePreflight(
  client: DefinitionAuthoringClient,
  environmentName: string,
): ReleasePreflightState {
  const [result, setResult] = useState<ReleasePreflight>();
  const [error, setError] = useState<string>();
  const [isWorking, setWorking] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const clear = useCallback((): void => { setResult(undefined); }, []);
  const run = useCallback(async (releaseDigest: string): Promise<void> => {
    setWorking(true);
    setError(undefined);
    try {
      setResult(await client.preflight(environmentName, releaseDigest));
      setNeedsLogin(false);
    } catch (reason) {
      setNeedsLogin(reason instanceof DefinitionAuthoringError && reason.status === 401);
      setError(reason instanceof Error ? reason.message : 'Release preflight failed.');
    } finally {
      setWorking(false);
    }
  }, [client, environmentName]);
  return { result, error, isWorking, needsLogin, clear, run };
}
