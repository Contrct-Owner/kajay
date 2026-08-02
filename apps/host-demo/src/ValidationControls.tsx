import type { CheckErrorsMode, QuestionErrorLocation, Survey } from '@kajay/core';
import type { ReactElement } from 'react';
import { useState } from 'react';

interface ChoiceControlProps<TValue extends string> {
  readonly id: string;
  readonly label: string;
  readonly value: TValue;
  readonly options: readonly (readonly [TValue, string])[];
  readonly onChange: (value: TValue) => void;
}

function ChoiceControl<TValue extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: ChoiceControlProps<TValue>): ReactElement {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as TValue);
        }}
      >
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </>
  );
}

const MODES: readonly (readonly [CheckErrorsMode, string])[] = [
  ['onNextPage', 'On next page'],
  ['onValueChanged', 'On value changed'],
  ['onComplete', 'On complete'],
];

const LOCATIONS: readonly (readonly [QuestionErrorLocation, string])[] = [
  ['top', 'Above the field'],
  ['bottom', 'Below the field'],
];

/**
 * Host-side controls for the survey's validation policy.
 *
 * Here rather than in `@kajay/react` because these are authoring choices, not
 * respondent ones — a real host sets them in the definition and never shows them. The
 * demo exposes them so each mode is observable in the running application, which is
 * what the checklist's demo-coverage rule asks for and what a unit test cannot give.
 *
 * The values are mirrored into React state because the model has no event for a policy
 * change: nothing on screen depends on it until the next check, so adding one would be
 * a channel with a single subscriber.
 */
export function ValidationControls({ model }: { readonly model: Survey }): ReactElement {
  const { validation } = model;
  const [mode, setMode] = useState<CheckErrorsMode>(validation.checkErrorsMode);
  const [location, setLocation] = useState<QuestionErrorLocation>(validation.errorLocation);
  const [isEnabled, setIsEnabled] = useState(validation.isEnabled);

  return (
    <section className="host-demo__panel" aria-label="Validation">
      <h2>Validation</h2>

      <div className="host-demo__controls">
        <ChoiceControl
          id="check-errors-mode"
          label="When to check"
          value={mode}
          options={MODES}
          onChange={(next) => {
            validation.setCheckErrorsMode(next);
            setMode(next);
          }}
        />

        <ChoiceControl
          id="question-error-location"
          label="Error position"
          value={location}
          options={LOCATIONS}
          onChange={(next) => {
            validation.setErrorLocation(next);
            setLocation(next);
          }}
        />

        <label>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => {
              validation.setEnabled(event.target.checked);
              setIsEnabled(event.target.checked);
            }}
          />
          {' Validation enabled'}
        </label>
      </div>
    </section>
  );
}
