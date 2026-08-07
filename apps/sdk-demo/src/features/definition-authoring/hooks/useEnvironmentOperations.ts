import { useMemo } from 'react';
import { DefinitionAuthoringClient } from '../api/DefinitionAuthoringClient.js';
import type { EnvironmentInput } from '../api/DefinitionAuthoringClient.js';
import type {
  EnvironmentBinding,
  ManagedEnvironment,
} from '../api/DefinitionAuthoringTypes.js';
import { useEnvironmentMutations } from './useEnvironmentMutations.js';
import { useEnvironmentQuery } from './useEnvironmentQuery.js';

export interface EnvironmentOperationsState {
  readonly environments: readonly ManagedEnvironment[];
  readonly selected: ManagedEnvironment | undefined;
  readonly bindings: readonly EnvironmentBinding[];
  readonly error: string | undefined;
  readonly isWorking: boolean;
  readonly create: (input: EnvironmentInput) => Promise<void>;
  readonly update: (input: Omit<EnvironmentInput, 'name'>) => Promise<void>;
  readonly setBinding: (name: string, reference: string) => Promise<void>;
  readonly removeBinding: (binding: EnvironmentBinding) => Promise<void>;
}

export function useEnvironmentOperations(
  environmentName: string,
  onSelect: (name: string) => void,
  onChanged: () => void,
): EnvironmentOperationsState {
  const client = useMemo(() => new DefinitionAuthoringClient(), []);
  const query = useEnvironmentQuery(client, environmentName);
  const selected = query.environments.find((item) => item.name === environmentName);
  const mutations = useEnvironmentMutations({
    client, environmentName, selected, bindings: query.bindings,
    load: query.load, onSelect, onChanged,
  });

  return {
    environments: query.environments,
    selected,
    bindings: query.bindings,
    error: mutations.error ?? query.error,
    isWorking: mutations.isWorking,
    create: mutations.create,
    update: mutations.update,
    setBinding: mutations.setBinding,
    removeBinding: mutations.removeBinding,
  };
}
