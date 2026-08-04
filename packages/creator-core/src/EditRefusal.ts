import type { CreatorStringKey } from './creatorStrings.js';

/**
 * Why an edit did not happen — [ADR-0023](../../../docs/adr/0023-the-creator-says-what-happened.md).
 *
 * **`undefined` means it happened.** Every edit that can refuse returns
 * `EditRefusal | undefined` rather than a boolean, which is the whole decision: a `false`
 * cannot be rendered, cannot be translated, and cannot be told apart from "nothing needed
 * doing". The shape is [`JsonEditorSession`](./JsonEditorSession.ts)'s `problem` — a
 * discriminated `kind` — because M2 answered this question once already and two spellings
 * of one idea is how a host ends up handling only the one it happened to meet.
 */
export interface EditRefusal {
  readonly kind: EditRefusalKind;
  /**
   * What the refusal is about: the name that was taken, the type that is not allowed.
   *
   * Fills the `{0}` in the message. Absent where the reason names nothing a designer
   * would recognise — a read-only deployment refuses every edit for one reason, and
   * quoting the property back would suggest a different one might have worked.
   */
  readonly subject?: string | undefined;
}

/**
 * Every reason an edit can be refused.
 *
 * A closed union rather than a string, so {@link refusalMessageKey} is total and adding a
 * reason without giving it words fails to compile — the same argument N3 made for the
 * string catalogue and ADR-0020 for diagnostic codes.
 */
export type EditRefusalKind =
  | 'name-empty'
  | 'name-taken'
  | 'unknown-property'
  | 'not-localizable'
  | 'read-only'
  | 'type-not-allowed'
  | 'not-found'
  | 'not-convertible'
  | 'not-placeable'
  | 'nothing-copied';

/**
 * The words for a reason, as a key in the Creator's own catalogue.
 *
 * **Here rather than in `creator-react`**, because the catalogue is here: a mapping in the
 * UI package would be a second table to keep in step, and a host drawing their own property
 * grid would have to write their own copy of it to say anything at all.
 *
 * Total by construction — a `Record` over the union, so the compiler refuses a new kind
 * that nobody gave words to.
 */
export function refusalMessageKey(kind: EditRefusalKind): CreatorStringKey {
  return REFUSAL_MESSAGES[kind];
}

const REFUSAL_MESSAGES: Readonly<Record<EditRefusalKind, CreatorStringKey>> = {
  'name-empty': 'refusalNameEmpty',
  'name-taken': 'refusalNameTaken',
  'unknown-property': 'refusalUnknownProperty',
  'not-localizable': 'refusalNotLocalizable',
  'read-only': 'refusalReadOnly',
  'type-not-allowed': 'refusalTypeNotAllowed',
  'not-found': 'refusalNotFound',
  'not-convertible': 'refusalNotConvertible',
  'not-placeable': 'refusalNotPlaceable',
  'nothing-copied': 'refusalNothingCopied',
};

/** A refusal of this kind, about this subject. Reads better than the object literal. */
export function refuse(kind: EditRefusalKind, subject?: string): EditRefusal {
  return subject === undefined ? { kind } : { kind, subject };
}
