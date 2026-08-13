import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

/** One view a pane can show: what it is called, and how a test asks for it. */
export interface SwitchMode<TMode extends string> {
  readonly value: TMode;
  readonly label: string;
  readonly testId: string;
}

/**
 * Two views of one thing, expressed as one segmented control.
 *
 * Generic over the views because the playground now has two of these and they are the
 * same control: a definition is a design or the JSON behind it, and a response is a form
 * or the JSON behind it. A second copy would be the place the two quietly stop matching.
 */
export function ModeSwitch<TMode extends string>({
  label,
  modes,
  mode,
  onModeChange,
}: {
  readonly label: string;
  readonly modes: readonly SwitchMode<TMode>[];
  readonly mode: TMode;
  readonly onModeChange: (mode: TMode) => void;
}): ReactElement {
  return (
    <div className="bg-muted inline-flex items-center rounded-md p-0.5" role="group" aria-label={label}>
      {modes.map((candidate) => (
        <Button
          key={candidate.value}
          size="sm"
          variant={mode === candidate.value ? 'default' : 'ghost'}
          className={mode === candidate.value ? '' : 'text-muted-foreground'}
          data-testid={candidate.testId}
          aria-current={mode === candidate.value ? 'page' : undefined}
          onClick={() => {
            onModeChange(candidate.value);
          }}
        >
          {candidate.label}
        </Button>
      ))}
    </div>
  );
}
