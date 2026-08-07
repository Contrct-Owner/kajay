import { useCallback, useEffect, useRef, useState } from 'react';
import type { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import { DefinitionAuthoringError } from '../api/DefinitionAuthoringError.js';
import type { DefinitionReleaseComparison } from '../api/DefinitionAuthoringTypes.js';

export interface ReleaseComparisonState {
  readonly result: DefinitionReleaseComparison | undefined;
  readonly targetDigest: string | undefined;
  readonly error: string | undefined;
  readonly isLoading: boolean;
  readonly needsLogin: boolean;
  readonly review: (releaseDigest: string) => Promise<void>;
  readonly clear: () => void;
}

export function useReleaseComparison(
  client: DefinitionAuthoringClient,
  managedName: string,
  environmentName: string,
): ReleaseComparisonState {
  const [result, setResult] = useState<DefinitionReleaseComparison>();
  const [targetDigest, setTargetDigest] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const requestId = useRef(0);

  const clear = useCallback((): void => {
    requestId.current += 1;
    setResult(undefined); setTargetDigest(undefined); setError(undefined);
    setLoading(false); setNeedsLogin(false);
  }, []);
  useEffect(() => clear(), [clear, environmentName, managedName]);

  const review = useCallback(async (releaseDigest: string): Promise<void> => {
    const currentRequest = ++requestId.current;
    setTargetDigest(releaseDigest); setResult(undefined); setError(undefined); setLoading(true);
    try {
      const comparison = await client.compareRelease(
        managedName, environmentName, releaseDigest,
      );
      if (requestId.current === currentRequest) {
        setResult(comparison); setNeedsLogin(false);
      }
    } catch (reason: unknown) {
      if (requestId.current === currentRequest) {
        setNeedsLogin(reason instanceof DefinitionAuthoringError && reason.status === 401);
        setError(readError(reason));
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [client, environmentName, managedName]);

  return { result, targetDigest, error, isLoading, needsLogin, review, clear };
}

function readError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Release comparison failed.';
}
