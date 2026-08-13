import { Question } from '@kajay/core';
import type { PageElement, Survey } from '@kajay/core';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { QuestionRenderer } from './QuestionRendererRegistry.js';

export interface PageElementRendererProps {
  readonly survey: Survey;
  readonly element: PageElement;
  readonly renderers: PageElementRendererResolver;
}

export type PageElementRenderer = (props: PageElementRendererProps) => ReactElement;

/** The complete capability needed to resolve and draw a page element. */
export interface PageElementRendererResolver {
  render(survey: Survey, element: PageElement): ReactElement;
  /**
   * The renderer for a question drawn *inside* prose, if this type has one.
   *
   * Part of resolving rather than a separate table a renderer has to be handed, because a
   * fill-in-the-blank draws its own blanks and is the only thing that needs it.
   *
   * Optional so a host that already implements this interface keeps compiling: adding a
   * required member to a published type is a breaking change, and a resolver without it
   * simply draws no inline fields.
   */
  inline?(type: string): QuestionRenderer | undefined;
}

/** A frozen registry can inspect and clone renderers, but cannot register them. */
export interface ReadonlyPageElementRendererRegistry extends PageElementRendererResolver {
  has(type: string): boolean;
  /** A mutable copy for one consumer's custom registrations. */
  clone(): PageElementRendererRegistry;
}

/** One dispatch table for every element a page may contain. */
export class PageElementRendererRegistry implements PageElementRendererResolver {
  readonly #renderers: Map<string, PageElementRenderer> = new Map();
  readonly #inline: Map<string, QuestionRenderer> = new Map();
  #frozen = false;

  register(type: string, renderer: PageElementRenderer): void {
    if (this.#frozen) {
      throw new Error('This page-element renderer registry is frozen; clone it before registering.');
    }
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

  /**
   * Registers how a type is drawn *inside* a line of prose — checklist C13, ADR-0048.
   *
   * **A second registration rather than a mode on the first.** A flag would oblige every
   * renderer a host has ever written to handle a case it has never heard of, and the
   * default behaviour of ignoring it is a fieldset drawn inside a paragraph. Absent by
   * default makes "this type cannot go inline" the same statement here that the definition
   * diagnostic makes in core.
   */
  registerInlineQuestion(type: string, renderer: QuestionRenderer): void {
    if (this.#frozen) {
      throw new Error('This page-element renderer registry is frozen; clone it before registering.');
    }
    this.#inline.set(type, renderer);
  }

  inline(type: string): QuestionRenderer | undefined {
    return this.#inline.get(type);
  }

  has(type: string): boolean {
    return this.#renderers.has(type);
  }

  /** Prevents process-global defaults from being changed; mutable clones stay cheap. */
  freeze(): ReadonlyPageElementRendererRegistry {
    this.#frozen = true;
    return this;
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
    for (const [type, renderer] of this.#inline) {
      copy.registerInlineQuestion(type, renderer);
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
