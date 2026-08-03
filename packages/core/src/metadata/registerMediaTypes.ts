import { FileQuestion } from '../model/FileQuestion.js';
import { SignatureQuestion } from '../model/SignatureQuestion.js';
import { MEDIA_TYPE_DEFINITIONS } from './mediaTypeDefinitions.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/** Registers the media types: a file attachment and a signature. */
export function registerMediaTypes(registry: MetadataRegistry): void {
  registry.addClass({ ...MEDIA_TYPE_DEFINITIONS.file, create: () => new FileQuestion() });
  registry.addClass({
    ...MEDIA_TYPE_DEFINITIONS.signature,
    create: () => new SignatureQuestion(),
  });
}
