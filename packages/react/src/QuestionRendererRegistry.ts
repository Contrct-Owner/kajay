import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';

export type QuestionRenderer = (props: QuestionRendererProps) => ReactElement;

/**
 * Maps a registered question type to the component that draws it.
 *
 * Renderer lookup is a registry rather than a switch so a custom question type can
 * supply its own component without this package knowing it exists.
 */
export class QuestionRendererRegistry {
  readonly #renderers: Map<string, QuestionRenderer> = new Map();

  register(type: string, renderer: QuestionRenderer): void {
    this.#renderers.set(type, renderer);
  }

  get(type: string): QuestionRenderer | undefined {
    return this.#renderers.get(type);
  }

  has(type: string): boolean {
    return this.#renderers.has(type);
  }

  /** A copy, so a host can extend the defaults without mutating them. */
  clone(): QuestionRendererRegistry {
    const copy = new QuestionRendererRegistry();
    for (const [type, renderer] of this.#renderers) {
      copy.register(type, renderer);
    }
    return copy;
  }
}
