import { useCallback, useState } from 'react';
import type {
  DefinitionAuthoringClient,
  EnvironmentInput,
} from '../api/DefinitionAuthoringClient.js';
import type {
  EnvironmentBinding,
  ManagedEnvironment,
} from '../api/DefinitionAuthoringTypes.js';

export interface EnvironmentMutationState {
  readonly error: string | undefined;
  readonly isWorking: boolean;
  readonly create: (input: EnvironmentInput) => Promise<void>;
  readonly update: (input: Omit<EnvironmentInput, 'name'>) => Promise<void>;
  readonly setBinding: (name: string, reference: string) => Promise<void>;
  readonly removeBinding: (binding: EnvironmentBinding) => Promise<void>;
}

export function useEnvironmentMutations(
  options: EnvironmentMutationOptions,
): EnvironmentMutationState {
  const { client, environmentName, selected, bindings, load, onSelect, onChanged } = options;
  const [error, setError] = useState<string>();
  const [isWorking, setWorking] = useState(false);
  const execute = useCallback(async (operation: () => Promise<unknown>): Promise<void> => {
    setWorking(true);
    setError(undefined);
    try {
      await operation();
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Environment operation failed.');
    } finally {
      setWorking(false);
    }
  }, [load, onChanged]);
  const create = useCallback(async (input: EnvironmentInput): Promise<void> => {
    await execute(async () => {
      const created = await client.createEnvironment(input);
      onSelect(created.name);
    });
  }, [client, execute, onSelect]);
  const update = useCallback(async (input: Omit<EnvironmentInput, 'name'>): Promise<void> => {
    if (selected !== undefined) {
      await execute(() => client.updateEnvironment(selected.name, selected.version, input));
    }
  }, [client, execute, selected]);
  const setBinding = useCallback(async (name: string, reference: string): Promise<void> => {
    const version = bindings.find((item) => item.name === name)?.version ?? 0;
    await execute(() => client.setBinding(environmentName, name, reference, version));
  }, [bindings, client, environmentName, execute]);
  const removeBinding = useCallback(async (binding: EnvironmentBinding): Promise<void> => {
    await execute(() => client.removeBinding(environmentName, binding.name, binding.version));
  }, [client, environmentName, execute]);
  return { error, isWorking, create, update, setBinding, removeBinding };
}

interface EnvironmentMutationOptions {
  readonly client: DefinitionAuthoringClient;
  readonly environmentName: string;
  readonly selected: ManagedEnvironment | undefined;
  readonly bindings: readonly EnvironmentBinding[];
  readonly load: () => Promise<void>;
  readonly onSelect: (name: string) => void;
  readonly onChanged: () => void;
}
