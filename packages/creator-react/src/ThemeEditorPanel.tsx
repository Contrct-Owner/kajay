import type { ThemeEditorSession, ThemeRow } from '@kajay/creator-core';
import { useCallback, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface ThemeEditorPanelProps {
  readonly session: ThemeEditorSession;
  readonly className?: string;
}

/** The empty option, so a field can be put back to "the theme does not name this". */
const NOT_SET = '';

/**
 * A theme as a form — checklist M5.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the session
 * and holds nothing.
 *
 * **No preview lives here, and that is the design.** A host renders M3's `PreviewPanel`
 * with `themeVariables(session.theme)` beside this and watches it change — so the live
 * preview is the survey a respondent gets, not a swatch board that could disagree with it,
 * and this file needs no knowledge of `@kajay/themes` (which `creator-react` may not import
 * anyway).
 */
export function ThemeEditorPanel({ session, className }: ThemeEditorPanelProps): ReactElement {
  useThemeVersion(session);

  return (
    <div className={joinClasses('kajay-theme', className)}>
      <ThemeControls session={session} />
      <ProblemReport session={session} />
      <div className="kajay-theme__fields">
        {session.rows.map((row) => (
          <ThemeFieldRow key={row.path} session={session} row={row} />
        ))}
      </div>
    </div>
  );
}

/**
 * One entry: what it is called, what it says, and whether the theme names it at all.
 *
 * The **unset state is drawn**, because it is a real and different answer from "empty
 * string" — a theme that does not name `cornerRadius` leaves the stylesheet's own default
 * alone (I2), and a designer needs to be able to tell that from having set it to nothing.
 */
function ThemeFieldRow({
  session,
  row,
}: {
  readonly session: ThemeEditorSession;
  readonly row: ThemeRow;
}): ReactElement {
  const id = `kajay-theme-${row.path.replaceAll('.', '-')}`;

  return (
    <div className="kajay-theme__row" data-set={row.isSet ? 'true' : undefined}>
      <label className="kajay-theme__label" htmlFor={id}>
        {row.title}
      </label>
      <ThemeFieldControl session={session} row={row} id={id} />
      {row.kind === 'color' ? (
        // A swatch rather than a colour picker. `<input type="color">` accepts `#rrggbb`
        // and nothing else, and a theme is free to hold `oklch(…)`, a `var(…)` reference,
        // or nothing at all — a picker would quietly show black for all three. The browser
        // renders whatever CSS colour is there, which is the honest preview.
        <span
          className="kajay-theme__swatch"
          data-testid={`theme-swatch-${row.path}`}
          aria-hidden="true"
          style={{ background: row.text } as CSSProperties}
        />
      ) : null}
      {row.description === undefined ? null : (
        <p className="kajay-theme__hint" id={`${id}-hint`}>
          {row.description}
        </p>
      )}
    </div>
  );
}

function ThemeFieldControl({
  session,
  row,
  id,
}: {
  readonly session: ThemeEditorSession;
  readonly row: ThemeRow;
  readonly id: string;
}): ReactElement {
  const { Input, Select } = useCreatorComponents();
  const describedBy = row.description === undefined ? undefined : `${id}-hint`;

  if (row.kind === 'choice') {
    return (
      <Select
        className="kajay-theme__input"
        id={id}
        data-testid={`theme-${row.path}`}
        aria-describedby={describedBy}
        value={row.text}
        // The empty option is what puts a field back to unset. Without it a choice, once
        // made, could never be taken back — and "the theme does not name this" is a value.
        options={[
          { value: NOT_SET, label: '(not set)' },
          ...(row.choices ?? []).map((choice) => ({ value: choice, label: choice })),
        ]}
        onValueChange={(value) => {
          session.setValue(row.path, value);
        }}
      />
    );
  }
  return (
    <Input
      className="kajay-theme__input"
      id={id}
      data-testid={`theme-${row.path}`}
      aria-describedby={describedBy}
      value={row.text}
      onValueChange={(text) => {
        session.setValue(row.path, text);
      }}
    />
  );
}

/** Putting the theme back, and taking it away as a file. */
function ThemeControls({ session }: { readonly session: ThemeEditorSession }): ReactElement {
  const { Button } = useCreatorComponents();

  return (
    <div className="kajay-theme__controls">
      <Button
        className="kajay-theme__reset"
        data-testid="theme-reset"
        disabled={!session.isDirty}
        onClick={() => {
          session.reset();
        }}
      >
        Reset
      </Button>
    </div>
  );
}

/** What went wrong with the last import, and where in the file. */
function ProblemReport({
  session,
}: {
  readonly session: ThemeEditorSession;
}): ReactElement | null {
  const problem = session.problem;
  if (problem === undefined) {
    return null;
  }
  return (
    <p
      className="kajay-theme__problem"
      aria-live="polite"
      aria-atomic="true"
      data-testid="theme-problem"
    >
      {problem.at === undefined
        ? problem.message
        : `Line ${String(problem.at.line)}, column ${String(problem.at.column)}: ${problem.message}`}
    </p>
  );
}

/** Re-renders when a field, a preset or an import changes the theme. */
export function useThemeVersion(session: ThemeEditorSession): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => session.onChanged.add(onStoreChange),
    [session],
  );
  const getSnapshot = useCallback((): number => session.version, [session]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
