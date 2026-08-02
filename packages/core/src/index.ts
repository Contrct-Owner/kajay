// The entire public surface of @kajay/core. Anything not re-exported here is private,
// and there are no subpath entries (ADR-0010) — this file *is* the package.

export { generateContract } from './contract/generateContract.js';
export { EventEmitter } from './events/EventEmitter.js';
export type { EventListener } from './events/EventEmitter.js';
export type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ValueChangedEvent,
} from './events/SurveyEvents.js';
export type {
  ChildCollectionDescriptor,
  ClassDefinition,
  ClassDescriptor,
} from './metadata/ClassDescriptor.js';
export { globalRegistry } from './metadata/globalRegistry.js';
export { MetadataRegistry } from './metadata/MetadataRegistry.js';
export type {
  PropertyDefinition,
  PropertyDescriptor,
  PropertyType,
  PropertyValue,
} from './metadata/PropertyDescriptor.js';
export { registerBuiltInTypes } from './metadata/registerBuiltInTypes.js';
export { Page } from './model/Page.js';
export { Question } from './model/Question.js';
export { Survey } from './model/Survey.js';
export { SurveyElement } from './model/SurveyElement.js';
export { TextQuestion } from './model/TextQuestion.js';
export type { ValueHost } from './model/ValueHost.js';
export type { Diagnostic, DiagnosticSeverity } from './serialization/Diagnostic.js';
export { parseSurvey } from './serialization/parseSurvey.js';
export type { ParseResult } from './serialization/parseSurvey.js';
export {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_ID,
  UnsupportedSchemaVersionError,
} from './serialization/schemaVersion.js';
export { serializeSurvey } from './serialization/serializeSurvey.js';
export type { SurveyDefinition } from './serialization/serializeSurvey.js';
