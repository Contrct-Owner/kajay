import type { PreviewSession } from '@kajay/creator-core';
import { PreviewPanel, usePreviewVersion } from '@kajay/creator-react';
import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

export interface DesignerPreviewProps {
  readonly theme: Readonly<Record<string, string>>;
  readonly session: PreviewSession;
}

/**
 * The preview tab, driven the way a host drives it — checklist M3.
 *
 * **The session is created by the assembly above, not here**, and that is the whole point
 * of it being a prop: this component is unmounted every time a designer switches back to
 * the Design tab, and a session built here would take the run with it. What has been
 * answered has to outlive the tab, or "go and check the wording, then come back" costs a
 * designer everything they had filled in.
 */
export function DesignerPreview({ theme, session }: DesignerPreviewProps): ReactElement {
  return (
    <section
      className="host-demo__panel"
      aria-label="Designer preview"
      style={theme as CSSProperties}
    >
      <h2>Preview</h2>
      {/* The host's own theme goes to the previewed survey, not just to the panel around
          it — a preview themed differently from the real thing is answering the wrong
          question about what the survey looks like. */}
      <PreviewPanel session={session} surveyProps={{ theme }} />
      <TestData session={session} />
    </section>
  );
}

/**
 * Answers to start a run with, and what the run has recorded — checklist M3's test data.
 *
 * Two halves of one thing, deliberately side by side: the seed is what a designer types to
 * reach page three without filling in pages one and two, and the readout is what a host
 * would actually submit. Seeing them together is what makes the seed checkable.
 */
function TestData({ session }: { readonly session: PreviewSession }): ReactElement {
  usePreviewVersion(session);
  const [draft, setDraft] = useState(() => JSON.stringify(session.testData, null, 2));
  const parsed = parseData(draft);

  return (
    <div className="host-demo__test-data">
      <label htmlFor="preview-test-data">Test data (JSON)</label>
      <textarea
        id="preview-test-data"
        data-testid="preview-test-data"
        rows={4}
        value={draft}
        aria-invalid={parsed === undefined}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <button
        type="button"
        data-testid="preview-seed"
        // Applied on a press rather than as it is typed: seeding restarts the run, and
        // doing that on every keystroke would restart it once per character.
        disabled={parsed === undefined}
        onClick={() => {
          if (parsed !== undefined) {
            session.setTestData(parsed);
          }
        }}
      >
        Seed and restart
      </button>
      <pre data-testid="preview-data">{JSON.stringify(session.data, null, 2)}</pre>
    </div>
  );
}

/** `undefined` means "do not seed", which is a real answer while somebody is typing. */
function parseData(text: string): Readonly<Record<string, unknown>> | undefined {
  if (text.trim().length === 0) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Readonly<Record<string, unknown>>)
      : undefined;
  } catch {
    return undefined;
  }
}
