import type { LogicSession } from '@kajay/creator-core';
import { LogicPanel } from '@kajay/creator-react';
import type { CSSProperties, ReactElement } from 'react';

export interface DesignerLogicProps {
  readonly theme: Readonly<Record<string, string>>;
  readonly session: LogicSession;
}

/**
 * The logic tab, driven the way a host drives it — checklist M1.
 *
 * Nothing to wire beyond the session: every edit here goes through the design surface, so
 * the logic tab, the property grid and the JSON tab are three views of one document and
 * cannot disagree about what a `visibleIf` says.
 */
export function DesignerLogic({ theme, session }: DesignerLogicProps): ReactElement {
  return (
    <section
      className="host-demo__panel"
      aria-label="Designer logic"
      style={theme as CSSProperties}
    >
      <h2>Logic</h2>
      <LogicPanel session={session} />
    </section>
  );
}
