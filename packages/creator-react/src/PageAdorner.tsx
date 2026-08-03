import type { DesignSurface } from '@kajay/creator-core';
import type { Page } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

export interface PageAdornerProps {
  readonly surface: DesignSurface;
  readonly page: Page;
}

/**
 * The page's own header on the canvas — checklist K4.
 *
 * A page is a selectable thing in its own right, not just the container the questions
 * arrived in: it has a title a respondent reads, and `visibleIf` and a time limit the
 * property grid will edit. Without this there was nowhere to click to select one.
 *
 * The title editor follows K3's decision and for the same reason: it sits *beside* the
 * rendered title rather than over it, so a designer sees both the field they are typing
 * in and the heading a respondent will read.
 *
 * A page with no title shows its name, greyed by the stylesheet. A blank heading would
 * be honest — a page without a title renders without one (E1) — and useless, because
 * there would be nothing to click.
 */
export function PageAdorner({ surface, page }: PageAdornerProps): ReactElement {
  const { Button, Input } = useCreatorComponents();
  const isSelected = surface.isSelected(page);
  const hasTitle = page.title.length > 0;

  return (
    <div
      className="kajay-designer__page"
      data-selected={isSelected ? 'true' : undefined}
      data-untitled={hasTitle ? undefined : 'true'}
    >
      <Button
        className="kajay-designer__page-select"
        aria-label={`Select page ${page.name}`}
        data-testid={`select-page-${page.name}`}
        onClick={() => {
          surface.select(page);
        }}
      >
        {hasTitle ? page.title : page.name}
      </Button>
      {isSelected ? (
        <Input
          className="kajay-designer__title"
          value={page.title}
          onValueChange={(value) => {
            surface.setTitle(page, value);
          }}
          aria-label={`Title of page ${page.name}`}
        />
      ) : null}
    </div>
  );
}
