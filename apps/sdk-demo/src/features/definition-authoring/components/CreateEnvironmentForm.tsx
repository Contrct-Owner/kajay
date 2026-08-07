import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { EnvironmentInput } from '../api/DefinitionAuthoringClient.js';

export function CreateEnvironmentForm({
  disabled,
  onCreate,
}: {
  readonly disabled: boolean;
  readonly onCreate: (input: EnvironmentInput) => Promise<void>;
}): ReactElement {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [position, setPosition] = useState(500);
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onCreate({ name, displayName, requiresApproval, position }).then(() => {
      setName('');
      setDisplayName('');
    });
  }
  return (
    <form onSubmit={submit}>
      <h5>Create environment</h5>
      <label>Slug<input value={name} pattern="[a-z0-9][a-z0-9-]*" maxLength={128}
        required onChange={(event) => { setName(event.target.value); }} /></label>
      <label>Display name<input value={displayName} maxLength={128} required
        onChange={(event) => { setDisplayName(event.target.value); }} /></label>
      <label>Position<input type="number" min="0" max="10000" value={position}
        onChange={(event) => { setPosition(event.target.valueAsNumber); }} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={requiresApproval}
        onChange={(event) => { setRequiresApproval(event.target.checked); }} /> Require approval</label>
      <button type="submit" disabled={disabled}>Create and inspect</button>
    </form>
  );
}
