import { useCallback, useEffect, useState } from 'react';
import type { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import type {
  EnvironmentBinding,
  ManagedEnvironment,
} from '../api/DefinitionAuthoringTypes.js';

export interface EnvironmentQueryState {
  readonly environments: readonly ManagedEnvironment[];
  readonly bindings: readonly EnvironmentBinding[];
  readonly error: string | undefined;
  readonly load: () => Promise<void>;
}

export function useEnvironmentQuery(
  client: DefinitionAuthoringClient,
  environmentName: string,
): EnvironmentQueryState {
  const [environments, setEnvironments] = useState<readonly ManagedEnvironment[]>([]);
  const [bindings, setBindings] = useState<readonly EnvironmentBinding[]>([]);
  const [error, setError] = useState<string>();
  const load = useCallback(async (): Promise<void> => {
    try {
      const [nextEnvironments, nextBindings] = await Promise.all([
        client.getEnvironments(),
        client.getBindings(environmentName),
      ]);
      setEnvironments(nextEnvironments);
      setBindings(nextBindings);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : 'Environment operations could not be loaded.');
    }
  }, [client, environmentName]);
  useEffect(() => { void load(); }, [load]);
  return { environments, bindings, error, load };
}
