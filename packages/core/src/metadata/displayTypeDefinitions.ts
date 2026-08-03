import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface DisplayTypeDefinitions {
  readonly displayElement: ClassMetadataDefinition;
  readonly html: ClassMetadataDefinition;
  readonly image: ClassMetadataDefinition;
}

/**
 * Authoritative metadata for the elements that show something and hold no answer.
 *
 * Parented to `pageelement`, not to `question`. The registry is what the Creator's
 * property grid is generated from, and offering `isRequired` or a `validators`
 * collection on a paragraph of text would be the grid faithfully reporting a lie.
 */
export const DISPLAY_TYPE_DEFINITIONS: DisplayTypeDefinitions = {
  displayElement: {
    name: 'displayelement',
    parent: 'pageelement',
    isAbstract: true,
  },
  html: {
    name: 'html',
    parent: 'displayelement',
    properties: [
      {
        name: 'html',
        type: 'string',
        description: 'Markup, rendered as markup. See HtmlElement on the trust boundary.',
      },
    ],
  },
  image: {
    name: 'image',
    parent: 'displayelement',
    properties: [
      { name: 'imageLink', type: 'string' },
      {
        name: 'altText',
        type: 'string',
        description: 'Falls back to the title, then to empty — a decorative image.',
      },
      {
        name: 'imageFit',
        type: 'string',
        defaultValue: 'contain',
        description: 'none, contain, cover or fill. Mirrors CSS object-fit.',
      },
      {
        name: 'contentMode',
        type: 'string',
        defaultValue: 'image',
        description: 'image or video.',
      },
      { name: 'imageWidth', type: 'number', description: 'CSS pixels. 0 lets layout decide.' },
      { name: 'imageHeight', type: 'number' },
    ],
  },
};
