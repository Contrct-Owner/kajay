import type { ReactElement } from 'react';
import { useEnvironmentOperations } from '../hooks/useEnvironmentOperations.js';
import { CreateEnvironmentForm } from './CreateEnvironmentForm.js';
import { EnvironmentBindings } from './EnvironmentBindings.js';
import { EnvironmentSettingsForm } from './EnvironmentSettingsForm.js';

export function EnvironmentManager({
  environmentName,
  onSelect,
  onChanged,
  onClose,
}: {
  readonly environmentName: string;
  readonly onSelect: (name: string) => void;
  readonly onChanged: () => void;
  readonly onClose: () => void;
}): ReactElement {
  const state = useEnvironmentOperations(environmentName, onSelect, onChanged);
  return (
    <section className="environment-manager" aria-labelledby="environment-manager-heading">
      <header>
        <div>
          <p className="eyebrow">Promotion targets</p>
          <h4 id="environment-manager-heading">Environment administration</h4>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </header>
      <p className="hint">
        Approval policy belongs to the environment. Binding references are write-only.
      </p>
      {state.error === undefined ? null : <p role="alert" className="provenance-error">{state.error}</p>}
      <div className="environment-admin-grid">
        <CreateEnvironmentForm disabled={state.isWorking} onCreate={state.create} />
        {state.selected === undefined ? (
          <p className="hint">The selected environment is unavailable.</p>
        ) : (
          <EnvironmentSettingsForm environment={state.selected}
            disabled={state.isWorking} onUpdate={state.update} />
        )}
      </div>
      <EnvironmentBindings bindings={state.bindings} disabled={state.isWorking}
        onSet={state.setBinding} onRemove={state.removeBinding} />
    </section>
  );
}
