import type { DesignSurface } from '@kajay/creator-core';
import type { PageElement } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface ElementActionsProps {
  readonly surface: DesignSurface;
  readonly element: PageElement;
}

/**
 * Duplicate, copy, paste and change type — checklist K5.
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
  const { Button, Select } = useCreatorComponents();
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
      <Select
        className="kajay-designer__type"
        aria-label={`Type of ${name}`}
        data-testid={`type-${name}`}
        value={element.type}
        options={surface.convertibleTypes.map((type) => ({ value: type, label: type }))}
        onValueChange={(type) => {
          surface.convert(name, type);
        }}
      />
    </span>
  );
}
