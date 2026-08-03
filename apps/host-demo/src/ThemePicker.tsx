import { darkTheme, lightTheme, panellessTheme, themeVariables } from '@kajay/themes';
import type { Theme } from '@kajay/themes';
import type { ReactElement } from 'react';

/** The presets the demo offers, in the order they are shown. */
const PRESETS: readonly Theme[] = [lightTheme, darkTheme, panellessTheme];

export interface ThemePickerProps {
  readonly selected: string;
  readonly onSelect: (name: string) => void;
}

/**
 * Switches the survey's theme at runtime — checklist I2 and I3.
 *
 * The host's control, not the library's: a survey does not decide what a page looks
 * like. All this does is compute a variable map from a theme and hand it over, which is
 * the whole of the theming contract.
 */
export function ThemePicker({ selected, onSelect }: ThemePickerProps): ReactElement {
  return (
    <div className="host-demo__controls">
      <label htmlFor="host-demo-theme">Theme</label>
      <select
        id="host-demo-theme"
        value={selected}
        onChange={(event) => {
          onSelect(event.target.value);
        }}
      >
        {PRESETS.map((theme) => (
          <option key={theme.name} value={theme.name}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The variables for a preset by name, falling back to the light one. */
export function variablesFor(name: string): Readonly<Record<string, string>> {
  const theme = PRESETS.find((candidate) => candidate.name === name) ?? lightTheme;
  return themeVariables(theme);
}
