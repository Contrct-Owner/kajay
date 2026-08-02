import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { ContentMode, ImageFit } from './ImageElement.js';
import { MultiSelectQuestion } from './MultiSelectQuestion.js';
import { isOneSelected } from './singleSelectSemantics.js';

/**
 * Choices shown as pictures.
 *
 * The one select type whose **arity is a property**. Everywhere else the split by arity
 * is a design-time fact — a radiogroup takes one answer, a checkbox takes several — and
 * that is why those semantics live in two base classes. An imagepicker decides at
 * authoring time, so it descends from the multi-select base and falls back to the
 * shared single-select rules when `multiSelect` is off. The alternative, two registered
 * types, would make a definition that flipped the flag a different question with a
 * different name.
 */
export class ImagePickerQuestion extends MultiSelectQuestion {
  override get type(): string {
    return 'imagepicker';
  }

  get multiSelect(): boolean {
    return this.getBooleanProperty('multiSelect');
  }

  get imageFit(): ImageFit {
    const declared = this.getStringProperty('imageFit');
    return declared === 'none' || declared === 'cover' || declared === 'fill'
      ? declared
      : 'contain';
  }

  get contentMode(): ContentMode {
    return this.getStringProperty('contentMode') === 'video' ? 'video' : 'image';
  }

  get imageWidth(): number {
    return this.getNumberProperty('imageWidth');
  }

  get imageHeight(): number {
    return this.getNumberProperty('imageHeight');
  }

  /**
   * Whether the choice text is shown under its picture.
   *
   * Off does not mean gone: the text is every tile's accessible name, so a renderer
   * hides it from sight and leaves it in the accessibility tree. A grid of unlabelled
   * pictures is not an answerable question for anyone who cannot see them.
   */
  get showLabel(): boolean {
    return this.getBooleanProperty('showLabel');
  }

  override isSelected(choiceValue: PropertyValue): boolean {
    return this.multiSelect ? super.isSelected(choiceValue) : isOneSelected(this.value, choiceValue);
  }

  /**
   * The single point where arity is decided.
   *
   * `select` is deliberately *not* overridden. The inherited one works out the next
   * selection and hands it here, so switching this switches both — and a `select`
   * override alongside it would be code that changes nothing, which a mutation test
   * duly proved by surviving its removal. The inherited path stays correct as long as
   * it funnels through here, and the reselect-clears test is what would notice if it
   * ever stopped.
   */
  override applySelection(choiceValues: readonly PropertyValue[]): void {
    if (this.multiSelect) {
      super.applySelection(choiceValues);
      return;
    }
    this.value = choiceValues[0];
  }
}
