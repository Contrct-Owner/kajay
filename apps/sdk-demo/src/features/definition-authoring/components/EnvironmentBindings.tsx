import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { EnvironmentBinding } from '../api/DefinitionAuthoringTypes.js';
import { formatTimestamp } from './provenanceFormatting.js';

export function EnvironmentBindings({
  bindings,
  disabled,
  onSet,
  onRemove,
}: {
  readonly bindings: readonly EnvironmentBinding[];
  readonly disabled: boolean;
  readonly onSet: (name: string, reference: string) => Promise<void>;
  readonly onRemove: (binding: EnvironmentBinding) => Promise<void>;
}): ReactElement {
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onSet(name, reference).then(() => { setName(''); setReference(''); });
  }
  return (
    <section className="environment-bindings" aria-labelledby="environment-bindings-heading">
      <h5 id="environment-bindings-heading">Write-only bindings</h5>
      {bindings.length === 0 ? <p className="hint">No bindings configured.</p> : (
        <ul>{bindings.map((binding) => (
          <li key={binding.name}>
            <span><strong>{binding.name}</strong><small>
              v{binding.version}, {binding.updatedBy}, {formatTimestamp(binding.updatedAt)}
            </small></span>
            <button type="button" disabled={disabled}
              onClick={() => { void onRemove(binding); }}>Remove</button>
          </li>
        ))}</ul>
      )}
      <form onSubmit={submit}>
        <label>Binding name<input value={name} maxLength={128} required
          onChange={(event) => { setName(event.target.value); }} /></label>
        <label>Secret or configuration reference<input type="password" value={reference}
          maxLength={2048} required autoComplete="off"
          onChange={(event) => { setReference(event.target.value); }} /></label>
        <button type="submit" disabled={disabled}>Set binding</button>
      </form>
    </section>
  );
}
