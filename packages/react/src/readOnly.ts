/**
 * How a read-only question says so, and where.
 *
 * `aria-readonly` rather than `disabled`, because the two say different things: a
 * disabled control is one that cannot be used *yet*, drops out of the tab order and
 * stops being readable, while a read-only one is a value someone is meant to read. On a
 * review screen the second is what is wanted, and the first is how a respondent ends up
 * unable to reach their own answers.
 *
 * **Where it goes is not a free choice.** `aria-readonly` is defined only on certain
 * roles — `checkbox`, `radiogroup`, `combobox`, `listbox`, `textbox`, `switch`,
 * `spinbutton`, `slider`, `grid` and a few more. It is *not* defined on `group`, which
 * is what a `<fieldset>` maps to, and not on `radio`. A single helper that spread the
 * attribute onto whatever it was handed could not know the difference, and for a long
 * time it did not: five renderers put it on a `<fieldset>`, and axe called it
 * `aria-allowed-attr` the first time anything swept a read-only survey.
 *
 * So there are three helpers, and each one's name states what it assumes about the
 * element it is spread onto. There is deliberately **no helper for a plain `group`**:
 * ARIA gives no way to say a group is read-only, and the honest answer is that the
 * controls inside it say it instead.
 */

/**
 * For a container that genuinely is a group of radios.
 *
 * It supplies the role as well as the attribute, because the attribute is only legal
 * *because* of the role — handing them out separately is how the two come apart again.
 */
export function readOnlyRadioGroup(isReadOnly: boolean): {
  readonly role: 'radiogroup';
  readonly 'aria-readonly': 'true' | undefined;
} {
  return { role: 'radiogroup', 'aria-readonly': isReadOnly ? 'true' : undefined };
}

/**
 * For a control whose own role carries the attribute: a checkbox, a switch, a `<select>`,
 * a text field.
 */
export function readOnlyControl(isReadOnly: boolean): {
  readonly 'aria-readonly': 'true' | undefined;
} {
  return { 'aria-readonly': isReadOnly ? 'true' : undefined };
}

/**
 * For a control ARIA gives no read-only state at all: a `radio`, or a button that
 * performs an action rather than holding a value.
 *
 * `aria-disabled` is the only thing that can be said, and it is not the compromise the
 * HTML `disabled` attribute would be: the control keeps its place in the tab order,
 * stays readable and stays announced. What it gives up is the claim that it can be
 * operated, which for a read-only answer is true.
 */
export function readOnlyAction(isReadOnly: boolean): {
  readonly 'aria-disabled': 'true' | undefined;
} {
  return { 'aria-disabled': isReadOnly ? 'true' : undefined };
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
