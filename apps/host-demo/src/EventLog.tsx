import type { Survey } from '@kajay/core';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

export interface EventLogProps {
  readonly model: Survey;
}

/**
 * What a host hears, written down — checklist A7.
 *
 * The typed event surface is the library's promise to everything that is *not* the
 * renderer: a partial save, an audit trail, an analytics call, a second view of the same
 * answers. That promise is only worth anything if the events fire from the model, so this
 * panel subscribes the way a real host would — no renderer, no callbacks threaded through
 * props — and prints what arrives.
 *
 * On the page rather than in the console, for the reason `CheckTimeline` is: a Playwright
 * failure snapshot captures the accessibility tree, so a scenario that goes wrong leaves
 * the event history in the artefact.
 */
export function EventLog({ model }: EventLogProps): ReactElement {
  const [entries, setEntries] = useState<readonly string[]>([]);

  useEffect(() => {
    const note = (line: string): void => {
      // Newest first and bounded: a long session should not turn the page into a
      // scrollback buffer, and what a scenario asserts on is always the last thing.
      setEntries((previous) => [line, ...previous].slice(0, 8));
    };
    const stopRecords = model.onRecordsChanged.add(({ question, key, change, count }) => {
      note(`${change} ${question.name}[${key}] (${String(count)})`);
    });
    const stopFiles = model.onFilesChanged.add(({ question, files, change }) => {
      note(`${change} ${question.name}: ${files.map((file) => file.name).join(', ')}`);
    });
    return () => {
      stopRecords();
      stopFiles();
    };
  }, [model]);

  return (
    <section className="host-demo__panel" aria-label="Model events">
      <h2>Model events</h2>
      <ol data-testid="event-log">
        {entries.map((entry, index) => (
          // The index is part of the identity on purpose: the same event can happen
          // twice in a row — add a row, add a row — and two entries reading the same
          // thing are two entries.
          <li key={`${entry}:${String(index)}`}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
