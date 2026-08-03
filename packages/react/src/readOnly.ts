/**
 * Marks a group of controls as read-only for assistive technology.
 *
 * `aria-readonly` rather than `disabled`, because the two say different things: a
 * disabled control is one that cannot be used *yet*, drops out of the tab order and
 * stops being readable, while a read-only one is a value someone is meant to read. On a
 * review screen the second is what is wanted, and the first is how a respondent ends up
 * unable to reach their own answers.
 */
export function readOnlyGroup(isReadOnly: boolean): {
  readonly 'aria-readonly': 'true' | undefined;
} {
  return { 'aria-readonly': isReadOnly ? 'true' : undefined };
}

/** Does nothing, and is the same nothing every time, so React sees a stable handler. */
function ignore(): void {
  /* the question is for reading */
}

/**
 * Wraps a respondent's change so a read-only question does not record it.
 *
 * The guard is on the handler rather than on the click, because cancelling the click's
 * default stops the *browser* toggling the control but not React reporting a change —
 * React synthesizes `onChange` for checkboxes and radios from the click itself, so
 * `preventDefault` leaves the model being written to by a question nobody may answer.
 * That cost a test, which is the only reason it is written down here.
 *
 * Refusing here also puts the rule in front of every renderer at once rather than
 * leaving each one to remember it.
 */
export function whenEditable(isReadOnly: boolean, apply: () => void): () => void {
  return isReadOnly ? ignore : apply;
}
