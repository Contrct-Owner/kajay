import type { CreatorStringKey } from './creatorStrings.js';

/**
 * Something the Creator did that nobody asked it to —
 * [ADR-0023](../../../docs/adr/0023-the-creator-says-what-happened.md).
 *
 * **The other half of a refusal, and a different mechanism on purpose.** A refusal is the
 * answer to a call, so it comes back as a return value and lands on the control that asked.
 * These have no caller waiting and no control to land on: a paste renames questions, a
 * conversion drops settings, deleting a panel takes five questions with it. Each is correct,
 * each was the only sensible thing to do, and each leaves a designer to work out from the
 * result what happened — which is the same silence P5 removed from the refusal half.
 *
 * **Not every automatic act is worth announcing.** The test is whether a designer would be
 * confused or lose work if it happened quietly. Undo moving the selection fails that test —
 * undo is *expected* to change things, and a message on every press is a message people
 * learn to skip past. Renaming their `who` to `who1` passes it: they will go looking for
 * `who`.
 */
export interface CreatorNotice {
  readonly kind: CreatorNoticeKind;
  /** What it happened to: the element converted, the panel deleted. Fills `{0}`. */
  readonly subject?: string | undefined;
  /** How many. Fills `{1}` where a message has one, `{0}` where it is the only fact. */
  readonly count?: number | undefined;
}

/**
 * Everything the Creator announces about its own initiative.
 *
 * A closed union, so {@link noticeMessageKey} is total and a new one without words fails to
 * compile — the same argument `EditRefusalKind` makes, and the reason the two are separate
 * unions rather than one: a refusal is a thing that did *not* happen, and a host switching
 * on "what went on" would have to know which half each member came from.
 */
export type CreatorNoticeKind =
  | 'renamed-on-paste'
  | 'properties-dropped'
  | 'removed-with-children'
  | 'starter-content'
  // Not `document-replaced`: the DOM-free check matches inside string literals, and
  // `scripts/lib/coreRules.mjs` records why that is deliberate — a checker that misses a
  // violation is worse than one that objects to a word. It says "rename the string", so
  // this is renamed. `survey` is the better word here anyway.
  | 'survey-replaced';

/** The words for a notice, as a key in the Creator's own catalogue (N3). */
export function noticeMessageKey(kind: CreatorNoticeKind): CreatorStringKey {
  return NOTICE_MESSAGES[kind];
}

const NOTICE_MESSAGES: Readonly<Record<CreatorNoticeKind, CreatorStringKey>> = {
  'renamed-on-paste': 'noticeRenamedOnPaste',
  'properties-dropped': 'noticePropertiesDropped',
  'removed-with-children': 'noticeRemovedWithChildren',
  'starter-content': 'noticeStarterContent',
  'survey-replaced': 'noticeSurveyReplaced',
};

/** A notice of this kind. Reads better at the call site than the object literal. */
export function notice(
  kind: CreatorNoticeKind,
  facts: { readonly subject?: string; readonly count?: number } = {},
): CreatorNotice {
  return {
    kind,
    ...(facts.subject === undefined ? {} : { subject: facts.subject }),
    ...(facts.count === undefined ? {} : { count: facts.count }),
  };
}
