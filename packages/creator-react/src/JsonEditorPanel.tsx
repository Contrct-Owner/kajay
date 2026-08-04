import type { JsonEditorProblem, JsonEditorSession } from '@kajay/creator-core';
import type { Diagnostic } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCallback, useSyncExternalStore } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';

export interface JsonEditorPanelProps {
  readonly session: JsonEditorSession;
  readonly className?: string;
}

/**
 * The definition as text — checklist M2.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the session
 * and holds nothing, so a host can put it in a tab, a drawer, or a second pane beside the
 * canvas.
 *
 * A plain textarea primitive rather than a code editor, and deliberately. A syntax-highlighting
 * editor is a large dependency with its own opinions about keyboard handling, focus and
 * markup — exactly what [ADR-0022](../../../docs/adr/0022-design-system-primitives.md) says
 * the Creator does not ship. Everything this row actually promises (two-way sync, syntax
 * and schema errors) is in the *model*, so a host who wants CodeMirror binds it to
 * `session.text` and `setText` and loses nothing.
 */
export function JsonEditorPanel({ session, className }: JsonEditorPanelProps): ReactElement {
  useJsonEditorVersion(session);
  const { Textarea } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <div className={joinClasses('kajay-json', className)}>
      <EditorControls session={session} />
      {session.isStale ? (
        <p
          className="kajay-json__stale"
          aria-live="polite"
          aria-atomic="true"
          data-testid="json-stale"
        >
          {text('jsonStale')}
        </p>
      ) : null}
      <label className="kajay-json__label" htmlFor="kajay-json-text">
        {text('jsonDefinition')}
      </label>
      <Textarea
        id="kajay-json-text"
        className="kajay-json__text"
        data-testid="json-text"
        spellCheck={false}
        value={session.text}
        aria-invalid={session.problem !== undefined}
        aria-describedby={session.problem === undefined ? undefined : 'kajay-json-problem'}
        onValueChange={(value) => {
          session.setText(value);
        }}
      />
      <ProblemReport problem={session.problem} />
      <DiagnosticList diagnostics={session.diagnostics} />
    </div>
  );
}

/** Applying the draft, and throwing it away. */
function EditorControls({ session }: { readonly session: JsonEditorSession }): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <div className="kajay-json__controls">
      <Button
        className="kajay-json__apply"
        data-testid="json-apply"
        // Blocked only when there is no definition to apply. Diagnostics are shown and do
        // not stop it — see the session.
        disabled={!session.canApply || !session.isDirty}
        onClick={() => {
          session.apply();
        }}
      >
        {text('jsonApply')}
      </Button>
      <Button
        className="kajay-json__revert"
        data-testid="json-revert"
        disabled={!session.isDirty}
        onClick={() => {
          session.revert();
        }}
      >
        {text('jsonRevert')}
      </Button>
    </div>
  );
}

/**
 * What stops the draft being a survey, and where.
 *
 * The location is only drawn when the error carried one — see `jsonLocation`. A line
 * number invented for an engine that did not report a position would be worse than none,
 * because a designer would go and look at it.
 */
function ProblemReport({
  problem,
}: {
  readonly problem: JsonEditorProblem | undefined;
}): ReactElement | null {
  if (problem === undefined) {
    return null;
  }
  return (
    <p className="kajay-json__problem" id="kajay-json-problem" data-testid="json-problem">
      {problem.at === undefined
        ? problem.message
        : `Line ${String(problem.at.line)}, column ${String(problem.at.column)}: ${problem.message}`}
    </p>
  );
}

/**
 * What the library says about the definition, whether or not it blocks anything.
 *
 * The **JSON Pointer is the location**, because that is what a diagnostic carries and it
 * is exact. Mapping `/pages/0/elements/1` to a line would mean a position-aware JSON parse
 * this row does not have; showing the pointer is honest and a designer can follow it.
 */
function DiagnosticList({
  diagnostics,
}: {
  readonly diagnostics: readonly Diagnostic[];
}): ReactElement | null {
  if (diagnostics.length === 0) {
    return null;
  }
  return (
    <ul className="kajay-json__diagnostics" data-testid="json-diagnostics">
      {diagnostics.map((diagnostic) => (
        <li
          key={`${diagnostic.code}:${diagnostic.path}`}
          className="kajay-json__diagnostic"
          data-severity={diagnostic.severity}
        >
          <code>{diagnostic.path.length > 0 ? diagnostic.path : '/'}</code> {diagnostic.message}
        </li>
      ))}
    </ul>
  );
}

/** Re-renders when the draft, the seed or the designer changes. */
export function useJsonEditorVersion(session: JsonEditorSession): number {
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
