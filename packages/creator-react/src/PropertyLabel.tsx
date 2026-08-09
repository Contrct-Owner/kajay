import type { ReactElement, ReactNode } from 'react';

export interface PropertyLabelProps {
  /** The control this names. */
  readonly htmlFor: string;
  readonly children: ReactNode;
  /** Whether the row carries an explanation, which draws the marker that reveals it. */
  readonly hasHint?: boolean;
}

/**
 * A property's name, and a marker when there is more to say about it — checklist L1.
 *
 * **The explanations used to be permanently on screen**, one under every field, which on a
 * question with thirty properties is a panel that is mostly prose about a panel. They are
 * genuinely useful and genuinely not needed most of the time, so they are still *there* and
 * no longer *shown*: the hint keeps its place in the accessibility tree, where the field
 * already points at it with `aria-describedby`, and the stylesheet reveals it on demand.
 *
 * **On demand means three things, because there are three ways to be working on a row.**
 * A pointer hovers this marker. A keyboard focuses the field, and the row shows its hint
 * for as long as that lasts — which is why the marker is not a tab stop of its own: the
 * hint arrives with the field rather than one Tab later. A touch is the second of those,
 * since tapping a field focuses it.
 *
 * **`aria-hidden`, and not a button.** A screen reader has already been told the
 * description as part of the field; a control whose only job is to reveal something its
 * user has already heard would be one more thing to step past. What is left is exactly what
 * it looks like — a mark saying there is an explanation here.
 *
 * The hint is revealed **in place** rather than floating over the row below, which is what
 * makes it need no dismiss gesture: content that appears on hover has to be dismissable
 * without moving the pointer only when it obscures something, and this obscures nothing.
 */
export function PropertyLabel({ htmlFor, children, hasHint }: PropertyLabelProps): ReactElement {
  return (
    <span className="kajay-properties__heading">
      <label className="kajay-properties__label" htmlFor={htmlFor}>
        {children}
      </label>
      {hasHint === true ? (
        <span className="kajay-properties__mark" aria-hidden="true">
          i
        </span>
      ) : null}
    </span>
  );
}
