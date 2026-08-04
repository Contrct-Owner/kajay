import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

type Appearance = 'light' | 'dark';

const STORAGE_KEY = 'kajay-site-appearance';

/**
 * One switch, two token systems — and the point is how little it takes.
 *
 * shadcn's dark mode is the class `dark` on the root element. Kajay's is the attribute
 * `data-kajay-theme="dark"` on the root element ([ADR-0008](../../../../docs/adr/0008-no-surveyjs-theme-import.md)).
 * Setting both is this function's entire job: neither library knows the other exists, and
 * there is no bridge, no synchronised variable table and nothing to fall out of step.
 *
 * That is worth demonstrating rather than describing. A survey engine whose theming had to
 * be *wired* to the host's would be a survey engine you could not drop into an application
 * that already had a dark mode.
 */
function apply(appearance: Appearance): void {
  const root = globalThis.document.documentElement;
  root.classList.toggle('dark', appearance === 'dark');
  root.dataset['kajayTheme'] = appearance;
}

/**
 * What the reader already asked for, before this page has an opinion.
 *
 * A remembered choice wins over the system preference, because somebody who has pressed
 * the button meant it. Read in an effect rather than during render: the server has no
 * `matchMedia` and no `localStorage`, and a first paint that guessed would flash.
 */
function preferred(): Appearance {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    ? 'dark'
    : 'light';
}

export function ThemeToggle(): ReactElement {
  const [appearance, setAppearance] = useState<Appearance>('light');

  useEffect(() => {
    const initial = preferred();
    setAppearance(initial);
    apply(initial);
  }, []);

  return (
    <Button
      size="sm"
      variant="outline"
      data-testid="theme-toggle"
      aria-label={appearance === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        const next = appearance === 'dark' ? 'light' : 'dark';
        setAppearance(next);
        apply(next);
        globalThis.localStorage?.setItem(STORAGE_KEY, next);
      }}
    >
      {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
      {appearance === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}
