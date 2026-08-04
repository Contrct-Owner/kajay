import { parseEditorText } from '@kajay/creator-core';
import type { DesignSurface, PropertyGridCategory, PropertyRow } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { readOnlyAction } from '@kajay/react';
import type { ComponentType } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { ExpressionField } from './ExpressionField.js';
import { TranslationsField } from './TranslationsField.js';
import { usePropertyEditor } from './PropertyEditors.js';
import type { PropertyEditorProps } from './PropertyEditors.js';

/**
 * The fields a property grid is drawn out of — checklists L1 and L2.
 *
 * Their own module because L2 draws them **twice**: once for the selected element, and
 * again inside a collection editor for each choice, validator or matrix column. A
 * validator's `minValue` is a registered number property, so the field that edits it is
 * the field that edits every other number — and a second implementation for children would
 * be the place the two quietly diverged.
 *
 * `scope` is what makes that possible: it prefixes the element ids so a question's own
 * `Visible if` and the `Visible if` of the third choice inside it are two different fields
 * with two different labels pointing at them.
 */

export interface PropertySectionProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly category: PropertyGridCategory;
  readonly scope: string;
}

export function PropertySection({
  surface,
  element,
  category,
  scope,
}: PropertySectionProps): ReactElement {
  return (
    <fieldset
      className="kajay-properties__section"
      // Scoped like the fields inside it: a choice in the collection editor draws its own
      // General section, and an unscoped hook found two of them.
      data-testid={`properties-${scope}-${category.name}`}
    >
      <legend className="kajay-properties__legend">{category.name}</legend>
      {category.rows.map((row) => (
        // Keyed on the scope as well as the property, so moving to a different element —
        // or a different choice — starts every field again rather than carrying a
        // half-typed draft across.
        <PropertyField
          key={`${scope}:${row.name}`}
          surface={surface}
          element={element}
          row={row}
          scope={scope}
        />
      ))}
    </fieldset>
  );
}

interface FieldProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly row: PropertyRow;
  readonly scope: string;
}

/**
 * One row: its label, its editor, and the registry's own description under it.
 *
 * The description is wired with `aria-describedby` rather than left as text near the
 * field. A hint that only sighted users get is the same hint being missing, and these are
 * the sentences that say what `titleLocation` accepts — which is exactly what somebody
 * using a text field for an enumerated property needs to hear.
 */
function PropertyField({ surface, element, row, scope }: FieldProps): ReactElement {
  const Custom = usePropertyEditor(row);
  const id = `kajay-prop-${scope}-${row.name}`;
  // Scoped like the id, and for the same reason: a question's `visibleIf` and the
  // `visibleIf` of the third choice inside it are two fields, and an unscoped hook found
  // three of them the moment a select question was selected.
  const testId = `property-${scope}-${row.name}`;
  const hintId = `${id}-hint`;
  const describedBy = row.description === undefined ? undefined : hintId;

  return (
    <div
      className="kajay-properties__row"
      data-property={row.name}
      data-read-only={row.isReadOnly ? 'true' : undefined}
    >
      <label className="kajay-properties__label" htmlFor={id}>
        {row.title}
      </label>
      <Editor
        Custom={Custom}
        surface={surface}
        element={element}
        row={row}
        id={id}
        hint={describedBy}
        testId={testId}
      />
      {row.description === undefined ? null : (
        <p className="kajay-properties__hint" id={hintId}>
          {row.description}
        </p>
      )}
      {row.isLocalizable ? (
        <TranslationsField surface={surface} element={element} row={row} id={id} />
      ) : null}
    </div>
  );
}

/**
 * The host's editor for this row, or the built-in one for its declared type — L4.
 *
 * The host's is consulted **first and unconditionally**: a replacement that only applied to
 * kinds the Creator had no opinion about would be no seam at all, and a host who has
 * decided how to draw `correctAnswer` has decided.
 */
function Editor({
  Custom,
  ...props
}: EditorProps & {
  readonly Custom: ComponentType<PropertyEditorProps> | undefined;
}): ReactElement {
  if (Custom !== undefined) {
    return <Custom {...props} />;
  }
  return props.row.editor === 'boolean' ? <BooleanField {...props} /> : <TextualField {...props} />;
}

interface EditorProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly row: PropertyRow;
  readonly id: string;
  readonly hint: string | undefined;
  readonly testId: string;
}

/**
 * A boolean, and how it says it may not be changed — checklists L1 and L3.
 *
 * The guard is on the **handler**, not on the click, which is E7's finding brought over
 * whole: cancelling the click's default stops the browser toggling the box but not React
 * reporting a change, because React synthesizes `onChange` for a checkbox from the click
 * itself. Refusing here leaves React to restore the control from `checked`, which is what
 * puts the box back.
 */
function BooleanField({ surface, element, row, id, hint, testId }: EditorProps): ReactElement {
  const { Checkbox } = useCreatorComponents();

  return (
    <Checkbox
      className="kajay-properties__checkbox"
      id={id}
      data-testid={testId}
      aria-describedby={hint}
      {...readOnlyAction(row.isReadOnly)}
      checked={row.value === true}
      onCheckedChange={(checked) => {
        if (!row.isReadOnly) {
          surface.setProperty(element, row.name, checked);
        }
      }}
    />
  );
}

/**
 * A text field over a value that is not always text — checklist L1.
 *
 * **What is typed and what is stored are two different strings**, which is why this holds a
 * draft rather than rendering `row.text` directly. A number field is empty for a moment
 * while somebody retypes it, `1.` is on the way to `1.5`, and a JSON object is unparseable
 * for as long as it takes to type one. A field driven straight from the model would snap
 * those back — clearing a number would rewrite it as `0`, and the dot would vanish
 * between the `1` and the `5`.
 *
 * The draft is re-seeded when the value changes *underneath* it — an undo, a different
 * selection, or the adorner's own title editor — and not when it changes *because* of it.
 * `shown` is what the model said last time this rendered, so the two cases are told apart
 * without the field having to know which edits were its own.
 *
 * A plain text field rather than `type="number"` for numbers, on purpose: a native number
 * input reports an empty string for anything it considers invalid, which is precisely the
 * half-typed states this exists to keep.
 */
function TextualField({ surface, element, row, id, hint, testId }: EditorProps): ReactElement {
  const [state, setState] = useState({ draft: row.text, shown: row.text });
  if (state.shown !== row.text) {
    setState({ draft: row.text, shown: row.text });
  }

  const commit = (text: string): void => {
    const value = parseEditorText(row.editor, text);
    if (value !== undefined) {
      surface.setProperty(element, row.name, value);
    }
  };
  const change = (text: string): void => {
    setState({ draft: text, shown: row.text });
    if (row.commit === 'change') {
      commit(text);
    }
  };
  const blur = (): void => {
    if (row.commit === 'blur') {
      commit(state.draft);
      // Re-seeded from the model rather than from the draft, so a refused rename — a
      // blank name, or one already taken — puts the old name back in the field instead
      // of leaving a name on screen that the survey does not have.
      setState({ draft: row.text, shown: row.text });
    }
  };

  // An expression field is the same draft over a different control: what it adds is a
  // suggestion list, and what it must not lose is L1's rule that a value changing
  // underneath the field re-seeds it.
  return row.isExpression ? (
    <ExpressionField
      surface={surface}
      owner={String(element.getPropertyValue('name') ?? '')}
      id={id}
      hint={hint}
      data-testid={testId}
      value={state.draft}
      onValueChange={change}
    />
  ) : (
    <PlainField
      row={row}
      id={id}
      hint={hint}
      testId={testId}
      draft={state.draft}
      onChange={change}
      onCommit={blur}
    />
  );
}

function PlainField({
  row,
  id,
  hint,
  testId,
  draft,
  onChange,
  onCommit,
}: {
  readonly row: PropertyRow;
  readonly id: string;
  readonly hint: string | undefined;
  readonly testId: string;
  readonly draft: string;
  readonly onChange: (text: string) => void;
  readonly onCommit: () => void;
}): ReactElement {
  const { Input } = useCreatorComponents();

  return (
    <Input
      className="kajay-properties__input"
      id={id}
      data-testid={testId}
      aria-describedby={hint}
      // Only where a designer can genuinely be wrong. An empty number field is somebody
      // mid-retype, not a mistake, and flagging it would cry wolf on every edit.
      aria-invalid={
        row.editor === 'json' && parseEditorText(row.editor, draft) === undefined ? true : undefined
      }
      readOnly={row.isReadOnly}
      value={draft}
      onValueChange={onChange}
      onBlur={onCommit}
    />
  );
}
