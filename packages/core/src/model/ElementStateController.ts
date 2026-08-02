import type { ElementStateChangedEvent, ElementStateKind } from '../events/SurveyEvents.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';

/**
 * Applies computed states to elements and records what actually changed.
 *
 * Changes are buffered rather than announced as they happen: logic settles first, and
 * only then does anyone hear about it, so an observer never sees the model part-way
 * through a cascade (ADR-0004's transaction model).
 */
export class ElementStateController {
  #version = 0;
  #pending: ElementStateChangedEvent[] = [];

  /**
   * Monotonic counter, incremented on every real change.
   *
   * Exactly the snapshot `useSyncExternalStore` wants — which is how the React adapter
   * re-renders without core knowing React exists.
   */
  get version(): number {
    return this.#version;
  }

  /** Reverts an element to its authored, unconditional state. */
  clear(element: SurveyElement, state: ElementStateKind): void {
    if (state === 'required') {
      if (element instanceof Question) {
        element.setRequiredOverride(undefined);
      }
      return;
    }
    this.apply(element, state, true);
  }

  apply(element: SurveyElement, state: ElementStateKind, value: boolean): void {
    if (state === 'visible') {
      if (element.isVisible === value) {
        return;
      }
      element.setVisibility(value);
    } else if (state === 'enabled') {
      if (element.isEnabled === value) {
        return;
      }
      element.setEnabled(value);
    } else {
      // `requiredIf` is meaningless on anything that cannot hold an answer.
      if (!(element instanceof Question) || element.isRequired === value) {
        return;
      }
      element.setRequiredOverride(value);
    }

    this.#version += 1;
    this.#pending.push({ element, state, value });
  }

  /**
   * Records that an element's choice list changed.
   *
   * Routed through the same buffer as the boolean states so the renderer has one
   * subscription, and so a list that changes mid-settle is still announced only once
   * the model has finished settling.
   */
  notifyChoicesChanged(element: SurveyElement): void {
    this.#version += 1;
    this.#pending.push({ element, state: 'choices' });
  }

  /** Hands over the buffered changes and empties the buffer. */
  drain(): readonly ElementStateChangedEvent[] {
    const pending = this.#pending;
    this.#pending = [];
    return pending;
  }
}
