import type { DesignSurface } from '@kajay/creator-core';
import type { TextRenderer } from '@kajay/react';
import { createElement, useCallback } from 'react';
import { useCreatorText } from './CreatorStringsContext.js';
import type { CreatorStringKey } from '@kajay/creator-core';
import { InlineText } from './InlineText.js';

/**
 * How the design canvas draws authored text — checklist P10.
 *
 * **A closed list of what is editable, not "anything with a subject".** A subject arrives
 * for every piece of prose the renderers draw, and most of them are not properties a
 * designer can type into: a rating's scale labels are computed, an expression question's
 * output is its answer. Editing those in place would offer an edit that cannot be stored.
 *
 * `key` on the element is what re-seeds it. `InlineText` is uncontrolled — the browser owns
 * the caret while typing — so the only correct time to replace its content from outside is
 * when the model's text really changed underneath: an undo, or an edit applied from the
 * JSON view.
 */
const EDITABLE: ReadonlyMap<string, CreatorStringKey> = new Map([
  ['title', 'titleOf'],
  // A panel's own prose. It is the one page element with words beyond a title, and the only
  // one a designer writes purely for the people reading it.
  ['description', 'descriptionOf'],
  ['choice', 'choiceLabel'],
]);

export function useInlineTextRenderer(surface: DesignSurface): TextRenderer {
  const label = useCreatorText();
  return useCallback<TextRenderer>(
    (text, subject) => {
      const labelKey = EDITABLE.get(subject.kind);
      if (labelKey === undefined) {
        return text;
      }
      return createElement(InlineText, {
        key: `${subject.owner}:${subject.property}:${subject.item ?? ''}:${text}`,
        surface,
        text,
        subject,
        // The same words the adorner's input carried, from N3's catalogue — "Title of who"
        // rather than "title". A host who renamed it keeps their word, and every scenario
        // that addressed the old input by its label still finds this.
        label: label(labelKey, subject.item ?? subject.owner),
      });
    },
    [surface, label],
  );
}
