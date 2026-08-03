import type { Survey } from '@kajay/core';
import { useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';

/** The languages the demo offers. `cy` is registered by the host, not shipped. */
const LOCALES: readonly { readonly tag: string; readonly label: string }[] = [
  { tag: 'en', label: 'English' },
  { tag: 'fr', label: 'Français' },
  { tag: 'de', label: 'Deutsch' },
  { tag: 'es', label: 'Español' },
  { tag: 'cy', label: 'Cymraeg' },
];

export interface LocalePickerProps {
  readonly model: Survey;
}

/**
 * Switches the survey's language at runtime — checklist J1 and J2.
 *
 * The host's control, like the theme picker beside it: which language a respondent
 * reads in is the host's decision, and all the library offers is `setLocale`. The
 * `<select>` reads the model rather than holding its own state, so anything else that
 * switched the locale — a trigger, a URL parameter, a host preference — would move it
 * too.
 */
export function LocalePicker({ model }: LocalePickerProps): ReactElement {
  const locale = useSyncExternalStore(
    (onStoreChange) => model.onLocaleChanged.add(onStoreChange),
    () => model.locale,
  );

  return (
    <div className="host-demo__controls">
      <label htmlFor="host-demo-locale">Language</label>
      <select
        id="host-demo-locale"
        value={locale}
        onChange={(event) => {
          model.setLocale(event.target.value);
        }}
      >
        {LOCALES.map((entry) => (
          <option key={entry.tag} value={entry.tag}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  );
}
