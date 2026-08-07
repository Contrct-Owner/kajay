import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DefinitionProvenanceState } from '../hooks/useDefinitionProvenance.js';
import { EnvironmentManager } from './EnvironmentManager.js';

export function EnvironmentOperations({
  state,
}: {
  readonly state: DefinitionProvenanceState;
}): ReactElement {
  const [isOpen, setOpen] = useState(false);
  if (!isOpen) {
    return (
      <button className="manage-environment" type="button" onClick={() => { setOpen(true); }}>
        Manage environments
      </button>
    );
  }
  return (
    <EnvironmentManager
      environmentName={state.environmentName}
      onSelect={state.selectEnvironment}
      onChanged={state.refresh}
      onClose={() => { setOpen(false); }}
    />
  );
}
