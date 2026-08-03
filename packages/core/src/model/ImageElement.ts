import { DisplayElement } from './DisplayElement.js';

/** How the media fills the box it is given. Mirrors CSS `object-fit`. */
export type ImageFit = 'none' | 'contain' | 'cover' | 'fill';

/** Whether the link points at a still image or at a video. */
export type ContentMode = 'image' | 'video';

/** A picture or a video, shown between questions. */
export class ImageElement extends DisplayElement {
  override get type(): string {
    return 'image';
  }

  get imageLink(): string {
    return this.getStringProperty('imageLink');
  }

  set imageLink(value: string) {
    this.setPropertyValue('imageLink', value);
  }

  /**
   * Alternative text.
   *
   * Falls back to the element's title, and to nothing at all when neither is set —
   * `alt=""` rather than `alt="someName"`, because an image with no description is
   * decorative and should be skipped, while an image labelled with an internal
   * identifier is noise read aloud.
   */
  get altText(): string {
    const authored = this.getStringProperty('altText');
    return authored.length > 0 ? authored : this.getStringProperty('title');
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

  /** Box width in CSS pixels. Zero means "let the layout decide". */
  get imageWidth(): number {
    return this.getNumberProperty('imageWidth');
  }

  get imageHeight(): number {
    return this.getNumberProperty('imageHeight');
  }
}
