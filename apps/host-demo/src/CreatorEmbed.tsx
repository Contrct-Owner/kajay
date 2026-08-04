import { CreatorStringDictionary } from '@kajay/creator-core';
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
 * A white-labelled deployment — checklist N3.
 *
 * Renaming rather than translating, which is the commoner half of white labelling: the same
 * language, a different vocabulary. Registering over the built-ins means these eight words
 * change and the other eighty do not.
 */
const WHITE_LABEL = new CreatorStringDictionary();
WHITE_LABEL.register('en', {
  tabDesign: 'Build',
  tabPreview: 'Try it',
  undo: 'Step back',
  redo: 'Step forward',
  addPage: 'Add a section',
  surveySettings: 'Form settings',
  toolboxSearch: 'Find a field',
  nothingSelected: 'Pick a field to edit it.',
});

/** And the tool's own colours, which are not the survey's — checklist N3. */
const WHITE_LABEL_THEME: Readonly<Record<string, string>> = {
  '--kajay-color-accent': '#7a3ea1',
  '--kajay-color-on-accent': '#ffffff',
};

/**
 * What a restricted deployment looks like — checklist N2.
 *
 * A plain value, which is the point: this could as easily have arrived as JSON from a
 * server keyed on which customer is logged in.
 */
const RESTRICTED = {
  tabs: ['design', 'preview'] as const,
  configuration: {
    allowedTypes: ['text', 'comment', 'radiogroup'],
    grid: { hidden: ['visibleIf', 'enableIf', 'requiredIf'] },
  },
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
  // **A second deployment of the same component, restricted** — checklist N2. Same library,
  // same props, a different configuration: three question types, no JSON or theme tab, and
  // the logic section of the property grid turned off.
  const [isRestricted, setRestricted] = useState(false);
  const [isWhiteLabelled, setWhiteLabelled] = useState(false);

  return (
    <section
      className="host-demo__panel"
      aria-label="Embedded creator"
      style={theme as CSSProperties}
    >
      <h2>Embedded creator</h2>
      <EmbedControls
        isShown={isShown}
        onShown={setShown}
        isRestricted={isRestricted}
        onRestricted={setRestricted}
        isWhiteLabelled={isWhiteLabelled}
        onWhiteLabelled={setWhiteLabelled}
      />
      {isShown ? (
        <EmbeddedCreator
          isRestricted={isRestricted}
          isWhiteLabelled={isWhiteLabelled}
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

/** The three switches this page uses to show off one component three ways. */
function EmbedControls({
  isShown,
  onShown,
  isRestricted,
  onRestricted,
  isWhiteLabelled,
  onWhiteLabelled,
}: {
  readonly isShown: boolean;
  readonly onShown: (shown: boolean) => void;
  readonly isRestricted: boolean;
  readonly onRestricted: (restricted: boolean) => void;
  readonly isWhiteLabelled: boolean;
  readonly onWhiteLabelled: (labelled: boolean) => void;
}): ReactElement {
  return (
    <>
      <button
        type="button"
        data-testid="toggle-embed"
        aria-expanded={isShown}
        onClick={() => {
          onShown(!isShown);
        }}
      >
        {isShown ? 'Hide the embedded creator' : 'Show the embedded creator'}
      </button>
      <DeploymentSwitch
        id="restrict-embed"
        testId="toggle-restricted"
        label=" Restrict this deployment"
        checked={isRestricted}
        onChange={onRestricted}
      />
      <DeploymentSwitch
        id="whitelabel-embed"
        testId="toggle-whitelabel"
        label=" White-label this deployment"
        checked={isWhiteLabelled}
        onChange={onWhiteLabelled}
      />
    </>
  );
}

/** One switch. Three of these is what turns one component into three deployments. */
function DeploymentSwitch({
  id,
  testId,
  label,
  checked,
  onChange,
}: {
  readonly id: string;
  readonly testId: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}

function EmbeddedCreator({
  value,
  onChange,
  onSaved,
  saves,
  isRestricted,
  isWhiteLabelled,
}: {
  readonly isRestricted: boolean;
  readonly isWhiteLabelled: boolean;
  readonly value: SurveyDefinition;
  readonly onChange: (definition: SurveyDefinition) => void;
  readonly onSaved: () => void;
  readonly saves: number;
}): ReactElement {
  return (
    <>
      <SurveyCreator
        // **Keyed on the deployment.** A configuration is read once, when the Creator's
        // models are built — see `useCreatorModels`, and the trap it exists to avoid. A
        // host changing which deployment they are showing is showing a *different* Creator,
        // and `key` is React's own way of saying so.
        key={`${isRestricted ? 'restricted' : 'full'}-${isWhiteLabelled ? 'labelled' : 'plain'}`}
        value={value}
        onChange={onChange}
        {...(isRestricted ? RESTRICTED : {})}
        {...(isWhiteLabelled
          ? { strings: WHITE_LABEL, creatorTheme: WHITE_LABEL_THEME }
          : {})}
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
