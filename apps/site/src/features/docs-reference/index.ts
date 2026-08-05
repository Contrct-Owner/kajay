export { docsReferenceManifest } from './generated/docsReferenceManifest.js';
export { authoredDocsManifest } from './generated/authoredDocsManifest.js';
export {
  createDocumentationSearchIndex,
  queryDocumentationSearch,
} from './documentationSearch.js';
export type {
  AuthoredPageSearchRecord,
  DocumentationSearchKind,
  DocumentationSearchResult,
} from './documentationSearch.js';
export type {
  ApiClassification,
  ApiSymbolReference,
  DefinitionPropertyReference,
  DefinitionTypeCategory,
  DefinitionTypeReference,
  DiagnosticReference,
  DocsReferenceManifest,
  DocumentationGap,
  ExpressionFunctionReference,
  ExpressionOperatorReference,
} from './docsReferenceTypes.js';
