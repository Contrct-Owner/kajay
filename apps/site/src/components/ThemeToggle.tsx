import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { APPEARANCE_STORAGE_KEY, applyAppearance } from '@/appearance';
import type { Appearance } from '@/appearance';

/**
 * The switch, and only the switch.
 *
 * **Deciding the appearance is no longer this component's job** — a decision taken in a
 * React effect happens after the browser has painted, which is what made every page flash
 * white before settling into dark. The document now applies it before it paints
 * (`APPEARANCE_SCRIPT`), and what is left here is what a button is actually for: reading
 * back what is on screen, and changing it.
 */
export function ThemeToggle(): ReactElement {
  // The server has no reader to ask, so it renders the light label and the first client
  // render corrects it. That correction is a word and an icon on one button, after the
  // page is already in the right colours — the flash this used to cause was the whole page.
  const [appearance, setAppearance] = useState<Appearance>('light');

  useEffect(() => {
    // Read rather than decided: the script in the head has already chosen and applied it,
    // and asking again here is how the two could disagree.
    const applied = globalThis.document.documentElement.dataset['kajayTheme'];
    setAppearance(applied === 'dark' ? 'dark' : 'light');
  }, []);

  return (
    <Button
      size="sm"
      variant="outline"
      data-testid="theme-toggle"
      aria-label={appearance === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        const next: Appearance = appearance === 'dark' ? 'light' : 'dark';
        setAppearance(next);
        applyAppearance(next);
        globalThis.localStorage?.setItem(APPEARANCE_STORAGE_KEY, next);
      }}
    >
      {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
      {appearance === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}
