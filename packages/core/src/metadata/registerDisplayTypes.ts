import { HtmlElement } from '../model/HtmlElement.js';
import { ImageElement } from '../model/ImageElement.js';
import { DISPLAY_TYPE_DEFINITIONS } from './displayTypeDefinitions.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/** Registers the elements that show something and hold no answer. */
export function registerDisplayTypes(registry: MetadataRegistry): void {
  registry.addClass(DISPLAY_TYPE_DEFINITIONS.displayElement);
  registry.addClass({ ...DISPLAY_TYPE_DEFINITIONS.html, create: () => new HtmlElement() });
  registry.addClass({ ...DISPLAY_TYPE_DEFINITIONS.image, create: () => new ImageElement() });
}
