import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { SurveyElement } from './SurveyElement.js';

/**
 * One choice in a select question.
 *
 * An element rather than a plain record so it gets everything the registry provides:
 * serialization, the contract, and — the reason B3 could not close without it —
 * `visibleIf`, evaluated by the same engine that drives question visibility.
 */
export class ItemValue extends SurveyElement {
  override get type(): string {
    return 'itemvalue';
  }

  /** The answer recorded when this choice is selected. */
  get value(): PropertyValue {
    return this.getPropertyValue('value') ?? '';
  }

  set value(next: PropertyValue) {
    this.setPropertyValue('value', next);
  }

  /** Display text. Falls back to the value, which is what most choice lists want. */
  get text(): string {
    const text = this.getStringProperty('text');
    return text.length > 0 ? text : String(this.value);
  }

  set text(next: string) {
    this.setPropertyValue('text', next);
  }

  /**
   * Picture or video for this choice.
   *
   * On every choice rather than on an image-only subclass, because `choices` declares
   * one element type and redeclaring it per question would give the registry two
   * collections under the same name. The cost is one property most choices never set;
   * the alternative was a special case in the serializer.
   */
  get imageLink(): string {
    return this.getStringProperty('imageLink');
  }

  set imageLink(next: string) {
    this.setPropertyValue('imageLink', next);
  }
}

/** Two lists are the same when their values and texts line up in order. */
export function choiceListsMatch(
  left: readonly ItemValue[],
  right: readonly ItemValue[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return other !== undefined && item.value === other.value && item.text === other.text;
    })
  );
}
