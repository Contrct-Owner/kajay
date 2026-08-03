import type { DesignSurface } from '@kajay/creator-core';
import type { PageElement } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface ElementActionsProps {
  readonly surface: DesignSurface;
  readonly element: PageElement;
}

/**
 * Duplicate, copy, paste, delete and change type — checklists K5 and K7.
 *
 * Shown only on the selected element, like K3's title editor and for the same reason:
 * four more controls on every question would bury the survey the designer is looking at
 * under the tools for editing it.
 *
 * They all act on the selection, which is what makes "paste" answerable — a paste has to
 * land somewhere, and the selected element is the only thing on screen that says where
 * the designer is working.
 */
export function ElementActions({ surface, element }: ElementActionsProps): ReactElement {
  const { Button } = useCreatorComponents();
  const name = element.name;

  return (
    <span className="kajay-designer__actions">
      <Button
        className="kajay-designer__action"
        data-testid={`duplicate-${name}`}
        onClick={() => {
          surface.duplicate(name);
        }}
      >
        Duplicate
      </Button>
      <Button
        className="kajay-designer__action"
        data-testid={`copy-${name}`}
        onClick={() => {
          surface.copy(name);
        }}
      >
        Copy
      </Button>
      <Button
        className="kajay-designer__action"
        data-testid={`paste-${name}`}
        disabled={!surface.canPaste}
        onClick={() => {
          surface.paste();
        }}
      >
        Paste
      </Button>
      <Button
        className="kajay-designer__action kajay-designer__delete"
        data-testid={`delete-${name}`}
        title="Delete (Del)"
        onClick={() => {
          surface.removeElement(name);
        }}
      >
        Delete
      </Button>
      <TypePicker surface={surface} element={element} />
    </span>
  );
}

/**
 * What the question is, and what it could be — checklist K5's conversion.
 *
 * Its own control because it is the one that is not a verb: the others do something to
 * the question, this one says what the question *is* and changes it by being changed.
 */
function TypePicker({ surface, element }: ElementActionsProps): ReactElement {
  const { Select } = useCreatorComponents();

  return (
    <Select
      className="kajay-designer__type"
      aria-label={`Type of ${element.name}`}
      data-testid={`type-${element.name}`}
      value={element.type}
      options={surface.convertibleTypes.map((type) => ({ value: type, label: type }))}
      onValueChange={(type) => {
        surface.convert(element.name, type);
      }}
    />
  );
}
