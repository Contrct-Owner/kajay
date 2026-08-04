import type { JsonEditorSession } from '@kajay/creator-core';
import { JsonEditorPanel } from '@kajay/creator-react';
import type { CSSProperties, ReactElement } from 'react';

export interface DesignerJsonProps {
  readonly theme: Readonly<Record<string, string>>;
  readonly session: JsonEditorSession;
}

/**
 * The JSON tab, driven the way a host drives it — checklist M2.
 *
 * The session is created by the assembly above for the reason the preview's is: this is
 * unmounted every time a designer switches tab, and a session built here would throw away
 * a half-written definition on the way to check something on the canvas.
 */
export function DesignerJson({ theme, session }: DesignerJsonProps): ReactElement {
  return (
    <section
      className="host-demo__panel"
      aria-label="Designer JSON"
      style={theme as CSSProperties}
    >
      <h2>JSON</h2>
      <JsonEditorPanel session={session} />
    </section>
  );
}
