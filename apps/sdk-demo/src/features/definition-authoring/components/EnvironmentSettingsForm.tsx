import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { EnvironmentInput } from '../api/DefinitionAuthoringClient.js';
import type { ManagedEnvironment } from '../api/DefinitionAuthoringTypes.js';

export function EnvironmentSettingsForm({
  environment,
  disabled,
  onUpdate,
}: {
  readonly environment: ManagedEnvironment;
  readonly disabled: boolean;
  readonly onUpdate: (input: Omit<EnvironmentInput, 'name'>) => Promise<void>;
}): ReactElement {
  const [displayName, setDisplayName] = useState(environment.displayName);
  const [requiresApproval, setRequiresApproval] = useState(environment.requiresApproval);
  const [position, setPosition] = useState(environment.position);
  useEffect(() => {
    setDisplayName(environment.displayName);
    setRequiresApproval(environment.requiresApproval);
    setPosition(environment.position);
  }, [environment]);
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onUpdate({ displayName, requiresApproval, position });
  }
  return (
    <form onSubmit={submit}>
      <h5>Selected: {environment.name}</h5>
      <label>Display name<input value={displayName} maxLength={128} required
        onChange={(event) => { setDisplayName(event.target.value); }} /></label>
      <label>Position<input type="number" min="0" max="10000" value={position}
        onChange={(event) => { setPosition(event.target.valueAsNumber); }} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={requiresApproval}
        onChange={(event) => { setRequiresApproval(event.target.checked); }} /> Require approval</label>
      <button type="submit" disabled={disabled}>Save policy</button>
      <small>Version {environment.version}; updated by {environment.updatedBy}</small>
    </form>
  );
}
