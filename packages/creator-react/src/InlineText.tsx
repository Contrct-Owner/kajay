import type { DesignSurface } from '@kajay/creator-core';
import type { TextSubject } from '@kajay/react';
import { useRef } from 'react';
import type { ReactElement } from 'react';

export interface InlineTextProps {
  readonly surface: DesignSurface;
  readonly text: string;
  readonly subject: TextSubject;
  /** What a screen reader hears. From N3's catalogue — see `useInlineTextRenderer`. */
  readonly label: string;
}

/**
 * Authored text, edited where it sits — checklist P10.
 *
 * **The canvas already draws the words; this makes them the editor.** K3 delivered "inline
 * title editing" as an input in the adorner, so a designer read the title in one place and
 * typed it in another, and a choice label could only be reached through the property grid
 * at all. The grid keeps everything with no visible representation — `visibleIf`, `name`,
 * validators — which is what it is good at.
 *
 * **`contentEditable` rather than a swapped-in `<input>`.** An input is a box, and a box on
 * a canvas full of real boxes reads as a field the respondent will see. This is the same
 * text in the same place, with the same font and wrapping, that happens to take a caret.
 *
 * **Committed on blur, not on every keystroke.** The definition is re-parsed on every edit
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3), so writing per
 * character would re-parse the survey per character and tear the caret out of the node
 * being typed in. Blur also makes "what I typed" one undo entry rather than twelve, which
 * is what a designer means by undoing a rename.
 *
 * The node is deliberately **uncontrolled**: React never sets `textContent` after mount, so
 * the browser owns the caret. `key` on the way in re-mounts it when the model changes
 * underneath — a JSON edit, an undo — which is the only time the text should be replaced
 * from outside.
 */
export function InlineText({ surface, text, subject, label }: InlineTextProps): ReactElement {
  const node = useRef<HTMLSpanElement>(null);

  const commit = (): void => {
    const typed = node.current?.textContent ?? '';
    if (typed === text) {
      return;
    }
    if (!writeText(surface, subject, typed)) {
      // Refused, or nothing to write to. Put back what the survey actually says rather
      // than leaving words on screen the definition has never heard of — P5's rule, and
      // the same one the property grid's fields follow.
      restore(node.current, text);
    }
  };

  return (
    <span
      ref={node}
      className="kajay-inline"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      data-testid={`inline-${subject.property}-${subject.owner}`}
      // A click on a question's title is a click on that question. Without this, editing
      // the words of something would leave the property grid showing something else.
      onFocus={() => {
        select(surface, subject.owner);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          // Titles are one line. Enter means "done", which is what it means in every
          // other single-line field on the canvas.
          event.preventDefault();
          node.current?.blur();
          return;
        }
        if (event.key === 'Escape') {
          restore(node.current, text);
          node.current?.blur();
        }
        // Everything else is typing, and must not reach the canvas: Delete would otherwise
        // remove the element being renamed, and the arrow keys would move it.
        event.stopPropagation();
      }}
    >
      {text}
    </span>
  );
}

/** Writes the edited text back. Says whether it landed. */
function writeText(surface: DesignSurface, subject: TextSubject, typed: string): boolean {
  const element = surface.elementNamed(subject.owner);
  if (element === undefined) {
    return false;
  }
  // Through `setProperty` rather than a direct write, so a localizable property merges into
  // the locale being edited instead of flattening every other language — J1's rule, and the
  // reason `propertyEdits.merged` exists.
  return surface.setProperty(element, subject.property, typed) === undefined;
}

function select(surface: DesignSurface, owner: string): void {
  const element = surface.elementNamed(owner);
  if (element !== undefined && !surface.isSelected(element)) {
    surface.select(element);
  }
}

/**
 * Puts the model's text back into the node.
 *
 * Written directly rather than through React, because the node is uncontrolled: React has
 * no record of what the browser put there, so re-rendering the same `text` prop changes
 * nothing and the rejected words would stay on screen.
 */
function restore(node: HTMLSpanElement | null, text: string): void {
  if (node !== null) {
    node.textContent = text;
  }
}
