import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * A panel that slides in over the page, built on the dialog primitive.
 *
 * Only the bottom edge, deliberately: the one caller is the playground's compact designer,
 * and a bottom sheet is the edge a thumb reaches. Sides get added when something wants one
 * rather than in advance — the generated shadcn component ships all four and three of them
 * would be untested code shaped like a feature.
 *
 * A dialog rather than a styled `<div>` because everything that makes an overlay usable is
 * already in the primitive: the focus trap, the restore on close, Escape, the inert
 * background, and `aria-modal`. A hand-rolled sheet is the same markup with those missing.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/**
 * The sheet itself.
 *
 * `max-h`/`overflow-y-auto` rather than a fixed height: the toolbox is thirty buttons and
 * the property grid is however many the selected element has, so the two callers differ by
 * an order of magnitude in length. Capping at 85svh leaves the top of the canvas visible
 * behind it, which is what stops a sheet from reading as a page you navigated to.
 */
function SheetContent({
  className,
  children,
  title,
  ...props
}: Omit<React.ComponentProps<typeof SheetPrimitive.Content>, 'title'> & {
  readonly title: string;
}) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/50"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'bg-background fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col gap-3 rounded-t-xl border-t p-4 shadow-lg',
          className,
        )}
        {...props}
      >
        <div className="flex shrink-0 items-center justify-between gap-4">
          <SheetPrimitive.Title className="text-sm font-medium">{title}</SheetPrimitive.Title>
          <SheetPrimitive.Close
            data-slot="sheet-close"
            aria-label="Close"
            className="focus-visible:ring-ring/50 hover:bg-accent rounded-md p-1 outline-none focus-visible:ring-[3px]"
          >
            <XIcon className="size-4" aria-hidden />
          </SheetPrimitive.Close>
        </div>
        {/* The description the dialog primitive warns about when it is missing. Off-screen
            rather than absent: it is worth saying to a screen reader and would be noise
            above a panel whose contents are self-evident to anyone who can see them. */}
        <SheetPrimitive.Description className="sr-only">
          {`${title}. Press Escape to close.`}
        </SheetPrimitive.Description>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetTrigger };
