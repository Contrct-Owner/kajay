import type { Survey } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';

/**
 * Puts the whole survey into display mode — checklist E7.
 *
 * A host control, because whether a response is being *given* or *reviewed* is the
 * host's decision: the same definition serves both, and a real application flips this
 * when it shows somebody what they submitted.
 *
 * It exists because nothing in the demo could reach that state. E7's survey-wide mode
 * was proven only in the browser suite, which loads no stylesheet and — more to the
 * point — was never swept by axe. The first time anything looked at a read-only choice
 * question with an accessibility checker, it found invalid ARIA that had been shipping
 * since E7.
 */
export function ReadOnlyToggle({ model }: { readonly model: Survey }): ReactElement {
  // Mirrored into React state because the model announces read-only on the element
  // channel, which this component does not otherwise subscribe to.
  const [isReadOnly, setIsReadOnly] = useState(model.isReadOnly);

  return (
    <div className="host-demo__controls">
      <label>
        <input
          type="checkbox"
          checked={isReadOnly}
          onChange={(event) => {
            model.setReadOnly(event.target.checked);
            setIsReadOnly(event.target.checked);
          }}
        />
        {' Read-only survey'}
      </label>
    </div>
  );
}
