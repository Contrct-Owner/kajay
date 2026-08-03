import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface MediaTypeDefinitions {
  readonly file: ClassMetadataDefinition;
  readonly signature: ClassMetadataDefinition;
}

/** Authoritative metadata for the media types (§H). */
export const MEDIA_TYPE_DEFINITIONS: MediaTypeDefinitions = {
  file: {
    name: 'file',
    parent: 'question',
    properties: [
      { name: 'allowMultiple', type: 'boolean' },
      {
        name: 'acceptedTypes',
        type: 'string',
        description: "An `accept` list — image/*, .pdf — offered to the picker and enforced.",
      },
      { name: 'maxSize', type: 'number', description: 'Bytes. 0 means no limit.' },
      { name: 'maxFileCount', type: 'number', description: '0 means no limit.' },
      { name: 'showPreview', type: 'boolean', defaultValue: true },
      {
        name: 'storeDataAsText',
        type: 'boolean',
        description: 'The content travels inside the response instead of being uploaded.',
      },
      {
        name: 'allowCameraCapture',
        type: 'boolean',
        description: 'Offer the camera as well as the filesystem, where the platform has one.',
      },
    ],
  },
  signature: {
    name: 'signaturepad',
    parent: 'question',
    properties: [
      { name: 'penColor', type: 'string', defaultValue: '#1d2939' },
      {
        name: 'backgroundColor',
        type: 'string',
        description: 'Empty is transparent, which is what a signature on a form usually wants.',
      },
      { name: 'signatureFormat', type: 'string', defaultValue: 'png', description: 'png, jpeg or svg.' },
      { name: 'signatureWidth', type: 'number', defaultValue: 400 },
      { name: 'signatureHeight', type: 'number', defaultValue: 160 },
    ],
  },
};
