import { parseEditorText } from '@kajay/creator-core';
import type { DesignSurface, PropertyGridCategory, PropertyRow } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useSurfaceVersion } from './useSurfaceVersion.js';

export interface PropertyGridPanelProps {
  readonly surface: DesignSurface;
  readonly className?: string;
}

/**
 * Every property of the selection, generated from the registry — checklist L1.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the
 * surface and holds nothing, so a host puts it in whichever panel their layout already
 * has. **Nothing here names a property or a type** — the sections, the order, the labels
 * and the editors all come from `surface.properties`, which is the whole claim of the row.
 *
 * It edits **whatever is selected**, and a page is selectable (K4), so selecting one shows
 * the page's own properties with no code about pages. §L5 is still open: the survey itself
 * is not selectable, and there is nowhere yet for the settings that belong to it.
 */
export function PropertyGridPanel({ surface, className }: PropertyGridPanelProps): ReactElement {
  useSurfaceVersion(surface);
  const selected = surface.selected;

  return (
    <div className={className === undefined ? 'kajay-properties' : `kajay-properties ${className}`}>
      {selected === undefined ? (
        // Deliberately not a live region. The canvas already has one for placement, and
        // K2 learned the expensive way that a second announcing element on the page is
        // something every test that looks one up has to start disambiguating.
        <p className="kajay-properties__empty">Select a question or a page to edit it.</p>
      ) : (
        surface
          .properties(selected)
          .map((category) => (
            <PropertySection
              key={category.name}
              surface={surface}
              element={selected}
              category={category}
            />
          ))
      )}
    </div>
  );
}

function PropertySection({
  surface,
  element,
  category,
}: {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly category: PropertyGridCategory;
}): ReactElement {
  const owner = String(element.getPropertyValue('name') ?? '');

  return (
    <fieldset className="kajay-properties__section" data-testid={`properties-${category.name}`}>
      <legend className="kajay-properties__legend">{category.name}</legend>
      {category.rows.map((row) => (
        // Keyed on the element as well as the property, so selecting a different question
        // starts every field again rather than carrying a half-typed draft across.
        <PropertyField key={`${owner}:${row.name}`} surface={surface} element={element} row={row} />
      ))}
    </fieldset>
  );
}

interface FieldProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly row: PropertyRow;
}

/**
 * One row: its label, its editor, and the registry's own description under it.
 *
 * The description is wired with `aria-describedby` rather than left as text near the
 * field. A hint that only sighted users get is the same hint being missing, and these are
 * the sentences that say what `titleLocation` accepts — which is exactly what somebody
 * using a text field for an enumerated property needs to hear.
 */
function PropertyField({ surface, element, row }: FieldProps): ReactElement {
  const id = `kajay-prop-${row.name}`;
  const hintId = `${id}-hint`;
  const describedBy = row.description === undefined ? undefined : hintId;

  return (
    <div className="kajay-properties__row" data-property={row.name}>
      <label className="kajay-properties__label" htmlFor={id}>
        {row.title}
      </label>
      {row.editor === 'boolean' ? (
        <BooleanField surface={surface} element={element} row={row} id={id} hint={describedBy} />
      ) : (
        <TextualField surface={surface} element={element} row={row} id={id} hint={describedBy} />
      )}
      {row.description === undefined ? null : (
        <p className="kajay-properties__hint" id={hintId}>
          {row.description}
        </p>
      )}
    </div>
  );
}

interface EditorProps extends FieldProps {
  readonly id: string;
  readonly hint: string | undefined;
}

function BooleanField({ surface, element, row, id, hint }: EditorProps): ReactElement {
  const { Checkbox } = useCreatorComponents();

  return (
    <Checkbox
      className="kajay-properties__checkbox"
      id={id}
      data-testid={`property-${row.name}`}
      aria-describedby={hint}
      checked={row.value === true}
      onCheckedChange={(checked) => {
        surface.setProperty(element, row.name, checked);
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
function TextualField({ surface, element, row, id, hint }: EditorProps): ReactElement {
  const { Input } = useCreatorComponents();
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

  return (
    <Input
      className="kajay-properties__input"
      id={id}
      data-testid={`property-${row.name}`}
      aria-describedby={hint}
      // Only where a designer can genuinely be wrong. An empty number field is somebody
      // mid-retype, not a mistake, and flagging it would cry wolf on every edit.
      aria-invalid={
        row.editor === 'json' && parseEditorText(row.editor, state.draft) === undefined
          ? true
          : undefined
      }
      value={state.draft}
      onValueChange={(text) => {
        setState({ draft: text, shown: row.text });
        if (row.commit === 'change') {
          commit(text);
        }
      }}
      onBlur={() => {
        if (row.commit === 'blur') {
          commit(state.draft);
          // Re-seeded from the model rather than from the draft, so a refused rename —
          // a blank name, or one already taken — puts the old name back in the field
          // instead of leaving a name on screen that the survey does not have.
          setState({ draft: row.text, shown: row.text });
        }
      }}
    />
  );
}
