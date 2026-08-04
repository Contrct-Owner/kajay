import { SurveyCreator } from '@kajay/creator-react';
import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

export interface CreatorEmbedProps {
  readonly theme: Readonly<Record<string, string>>;
}

/** A small survey to design, kept apart from the one the demo asks you to answer. */
const DESIGNED: SurveyDefinition = {
  title: 'An embedded survey',
  pages: [
    {
      name: 'e1',
      elements: [
        { type: 'text', name: 'embedName', title: 'Embedded: your name' },
        { type: 'radiogroup', name: 'embedTier', title: 'Embedded: tier?', choices: ['a', 'b'] },
      ],
    },
  ],
};

/**
 * The whole Creator as one component — checklist N1.
 *
 * **Controlled, the way a host actually holds it:** the definition lives in this file's
 * state, every change comes back through `onChange`, and the value goes straight back in.
 * That echo is the thing the row has to survive — a Creator that treated its own output as
 * an incoming document would re-open itself on every keystroke.
 *
 * The save seam is a pretend backend that refuses one particular title, so both answers are
 * demonstrable. Nothing about where a survey goes ships in the library.
 */
export function CreatorEmbed({ theme }: CreatorEmbedProps): ReactElement {
  const [value, setValue] = useState<SurveyDefinition>(DESIGNED);
  const [saves, setSaves] = useState(0);
  // **Off by default, and the reason is the same one M3 recorded.** The whole Creator is a
  // toolbox, a canvas, an undo button and a page navigator; a second one on the page makes
  // every page-wide query in this app's own scenarios ambiguous. Two Creators at once is a
  // demo artefact rather than something the library minds, so the demo hides one.
  const [isShown, setShown] = useState(false);

  return (
    <section
      className="host-demo__panel"
      aria-label="Embedded creator"
      style={theme as CSSProperties}
    >
      <h2>Embedded creator</h2>
      <button
        type="button"
        data-testid="toggle-embed"
        aria-expanded={isShown}
        onClick={() => {
          setShown(!isShown);
        }}
      >
        {isShown ? 'Hide the embedded creator' : 'Show the embedded creator'}
      </button>
      {isShown ? (
        <EmbeddedCreator
          value={value}
          onChange={setValue}
          onSaved={() => {
            setSaves((count) => count + 1);
          }}
          saves={saves}
        />
      ) : null}
    </section>
  );
}

function EmbeddedCreator({
  value,
  onChange,
  onSaved,
  saves,
}: {
  readonly value: SurveyDefinition;
  readonly onChange: (definition: SurveyDefinition) => void;
  readonly onSaved: () => void;
  readonly saves: number;
}): ReactElement {
  return (
    <>
      <SurveyCreator
        value={value}
        onChange={onChange}
        isAutoSave
        save={(definition) => {
          onSaved();
          // A title a designer can type to make the backend refuse, so the failure path is
          // on screen rather than only in a unit test. A real host talks to theirs here.
          return !JSON.stringify(definition).includes('refuse-this-save');
        }}
      />
      <p data-testid="embed-saves">{`Saves attempted: ${String(saves)}`}</p>
      <pre data-testid="embed-value">{JSON.stringify(value, undefined, 2)}</pre>
    </>
  );
}
