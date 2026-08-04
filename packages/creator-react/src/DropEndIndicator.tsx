import type { ReactElement } from 'react';

/** The visible insertion line for a container's final slot. */
export function DropEndIndicator({ container }: { readonly container: string }): ReactElement {
  return (
    <div
      className="kajay-designer__drop-end"
      data-testid="drop-at-end"
      data-in-container={container}
    />
  );
}
