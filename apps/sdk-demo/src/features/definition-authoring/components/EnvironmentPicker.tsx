import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

export function EnvironmentPicker({
  environmentName,
  environments,
  onSelect,
  onRefresh,
}: {
  readonly environmentName: string;
  readonly environments: readonly string[];
  readonly onSelect: (name: string) => void;
  readonly onRefresh: () => void;
}): ReactElement {
  const [input, setInput] = useState(environmentName);
  useEffect(() => { setInput(environmentName); }, [environmentName]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSelect(input);
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="managed-environment">Environment</label>
      <input id="managed-environment" list="managed-environments" value={input}
        maxLength={128} required onChange={(event) => { setInput(event.target.value); }} />
      <datalist id="managed-environments">{environments.map((name) => (
        <option key={name} value={name} />
      ))}</datalist>
      <button type="submit">Inspect</button>
      <button type="button" onClick={onRefresh}>Refresh</button>
    </form>
  );
}
