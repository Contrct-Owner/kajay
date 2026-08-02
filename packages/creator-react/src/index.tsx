import { listToolboxItems } from '@kajay/creator-core';
import type { ReactElement } from 'react';

/**
 * Phase 3 scope. A stub that proves `creator-core ← creator-react` resolves and that
 * the toolbox really is registry-derived.
 */
export function ToolboxPreview(): ReactElement {
  return (
    <ul className="kajay-toolbox">
      {listToolboxItems().map((item) => (
        <li className="kajay-toolbox__item" key={item.type}>
          {item.type}
        </li>
      ))}
    </ul>
  );
}
