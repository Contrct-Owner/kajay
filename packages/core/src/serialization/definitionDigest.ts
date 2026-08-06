import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import type { Survey } from '../model/Survey.js';
import { bindDefinitionDigest } from '../model/SurveySnapshot.js';
import type { SurveyDefinition } from './serializeSurvey.js';
import { serializeSurvey } from './serializeSurvey.js';
import { sha256 } from './sha256.js';

/** Computes the content identity of an already-canonical survey definition. */
export function digestCanonicalDefinition(definition: SurveyDefinition): string {
  return `sha256:${sha256(JSON.stringify(definition))}`;
}

export function digestAndBindDefinition(survey: Survey, registry: MetadataRegistry): string {
  const digest = digestCanonicalDefinition(serializeSurvey(survey, registry));
  bindDefinitionDigest(survey, digest);
  return digest;
}
