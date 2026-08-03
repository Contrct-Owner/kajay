import { Question } from '@kajay/core';
import type { PageElement, Survey } from '@kajay/core';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { QuestionRenderer } from './QuestionRendererRegistry.js';

export interface PageElementRendererProps {
  readonly survey: Survey;
  readonly element: PageElement;
  readonly renderers: PageElementRendererRegistry;
}

export type PageElementRenderer = (props: PageElementRendererProps) => ReactElement;

/** One dispatch table for every element a page may contain. */
export class PageElementRendererRegistry {
  readonly #renderers: Map<string, PageElementRenderer> = new Map();

  register(type: string, renderer: PageElementRenderer): void {
    this.#renderers.set(type, renderer);
  }

  /** Keeps custom question renderers narrow while storing them in the unified table. */
  registerQuestion(type: string, renderer: QuestionRenderer): void {
    this.register(type, ({ survey, element }) => {
      if (!(element instanceof Question)) {
        return unsupported(element, `Renderer for "${type}" only accepts questions.`);
      }
      return createElement(renderer, { survey, question: element });
    });
  }

  has(type: string): boolean {
    return this.#renderers.has(type);
  }

  render(survey: Survey, element: PageElement): ReactElement {
    const renderer = this.#renderers.get(element.type);
    return renderer === undefined
      ? unsupported(element, `No renderer is registered for page element "${element.type}".`)
      : createElement(renderer, { survey, element, renderers: this });
  }

  /** A copy, so a host can extend the defaults without mutating them. */
  clone(): PageElementRendererRegistry {
    const copy = new PageElementRendererRegistry();
    for (const [type, renderer] of this.#renderers) {
      copy.register(type, renderer);
    }
    return copy;
  }
}

function unsupported(element: PageElement, message: string): ReactElement {
  return createElement(
    'div',
    {
      className: 'kajay-question kajay-question--unsupported',
      'data-element-name': element.name,
    },
    message,
  );
}
