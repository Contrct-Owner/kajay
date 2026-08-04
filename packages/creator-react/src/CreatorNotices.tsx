import { noticeMessageKey } from '@kajay/creator-core';
import type { CreatorNotice, DesignSurface } from '@kajay/creator-core';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useCreatorText } from './CreatorStringsContext.js';

/**
 * What the Creator did that nobody asked for, said out loud —
 * [ADR-0023](../../../docs/adr/0023-the-creator-says-what-happened.md).
 *
 * **Polite, not assertive.** These announce things that *worked*: a paste that renumbered
 * two names, a conversion that dropped a setting. `role="status"` waits for a pause rather
 * than cutting across what a screen reader is already saying, which is the distinction from
 * P5's refusal note — a refusal is an answer somebody is waiting for, and this is the
 * Creator mentioning what it did.
 *
 * **One at a time, and it stays.** A stack of these would be a notification centre, which
 * [ADR-0023](../../../docs/adr/0023-the-creator-says-what-happened.md) rejected as the
 * primary mechanism: somewhere messages go to be dismissed unread. The most recent thing
 * the Creator did to a designer's survey is the one worth a line on screen, and it stays
 * there until the next one replaces it rather than vanishing on a timer somebody has to
 * beat.
 */
export interface CreatorNoticesProps {
  readonly surface: DesignSurface;
  readonly className?: string;
}

export function CreatorNotices({ surface, className }: CreatorNoticesProps): ReactElement {
  const latest = useLatestNotice(surface);
  const text = useCreatorText();

  return (
    <p
      className={className ?? 'kajay-creator__notices'}
      data-testid="creator-notices"
      aria-label={text('creatorNotices')}
      role="status"
      aria-live="polite"
    >
      {latest === undefined ? '' : text(noticeMessageKey(latest.kind), ...factsOf(latest))}
    </p>
  );
}

/**
 * The most recent notice, or `undefined` before anything has happened.
 *
 * A subscription rather than derived state, because a notice is an *event*: it is not a
 * property of the document, and a view that recomputed it from the surface would announce
 * the same paste again every time something else changed.
 */
export function useLatestNotice(surface: DesignSurface): CreatorNotice | undefined {
  const [latest, setLatest] = useState<CreatorNotice>();
  const listen = useCallback(
    (received: CreatorNotice) => {
      setLatest(received);
    },
    [],
  );

  useEffect(() => surface.onNotice.add(listen), [surface, listen]);

  return latest;
}

/**
 * A notice's facts in the order its message spells them.
 *
 * `{0}` is the subject where there is one and the count otherwise, which is what lets
 * "Deleted “{0}” and the {1} elements inside it" and "{0} pasted names…" both read
 * naturally rather than forcing every message to carry an unused placeholder.
 */
function factsOf(received: CreatorNotice): readonly (string | number)[] {
  const facts: (string | number)[] = [];
  if (received.subject !== undefined) {
    facts.push(received.subject);
  }
  if (received.count !== undefined) {
    facts.push(received.count);
  }
  return facts;
}
