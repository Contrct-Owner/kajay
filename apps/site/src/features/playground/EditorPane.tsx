import type { CreatorWorkspace } from '@kajay/creator-core';
import { JsonEditorPanel, useDesignerPlacement } from '@kajay/creator-react';
import type { ReactElement } from 'react';
import { DesignerLayout } from './DesignerLayout';
import type { EditorMode } from './EditorMode';

/**
 * The designer and JSON editor are two views over the same CreatorWorkspace document.
 * Editing JSON and switching back therefore updates the canvas through the same surface
 * and history stack rather than handing a document between independent implementations.
 */
export function EditorPane({
  workspace,
  mode,
}: {
  readonly workspace: CreatorWorkspace;
  readonly mode: EditorMode;
}): ReactElement {
  const placement = useDesignerPlacement(workspace.surface);

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Editor">
      {mode === 'design' ? (
        <DesignerLayout workspace={workspace} placement={placement} />
      ) : (
        <JsonEditorPanel session={workspace.json} />
      )}
    </section>
  );
}
