import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import type { EditorMode } from './EditorMode';

/** Design and JSON are two views of one document, expressed as one segmented control. */
export function ModeSwitch({
  mode,
  onModeChange,
}: {
  readonly mode: EditorMode;
  readonly onModeChange: (mode: EditorMode) => void;
}): ReactElement {
  return (
    <div className="bg-muted inline-flex items-center rounded-md p-0.5">
      {(['design', 'json'] as const).map((name) => (
        <Button
          key={name}
          size="sm"
          variant={mode === name ? 'default' : 'ghost'}
          className={mode === name ? '' : 'text-muted-foreground'}
          data-testid={`editor-mode-${name}`}
          aria-current={mode === name ? 'page' : undefined}
          onClick={() => {
            onModeChange(name);
          }}
        >
          {name === 'design' ? 'Design' : 'JSON'}
        </Button>
      ))}
    </div>
  );
}
