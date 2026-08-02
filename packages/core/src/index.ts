// The entire public surface of @kajay/core. Anything not re-exported here is private,
// and there are no subpath entries (ADR-0010) — this file *is* the package.

export { generateContract } from './contract/generateContract.js';
export { EventEmitter } from './events/EventEmitter.js';

// --- Expression language (ADR-0003) ---------------------------------------
export {
  createDefaultFunctionRegistry,
  registerBuiltInFunctions,
} from './expressions/builtInFunctions.js';
export { collectReferences } from './expressions/collectReferences.js';
export { createValueResolver, evaluateExpression } from './expressions/evaluateExpression.js';
export type {
  EvaluationContext,
  EvaluationResult,
} from './expressions/evaluateExpression.js';
export { ExpressionCache } from './expressions/ExpressionCache.js';
export type { ExpressionError } from './expressions/ExpressionError.js';
export type {
  ExpressionFunction,
  ExpressionFunctionContext,
} from './expressions/ExpressionFunction.js';
export { formatPath } from './expressions/ExpressionNode.js';
export type {
  ArrayNode,
  BinaryNode,
  BinaryOperator,
  CallNode,
  ErrorNode,
  ExpressionNode,
  LiteralNode,
  LiteralValue,
  PathSegment,
  PostfixNode,
  PostfixOperator,
  ReferenceNode,
  SourceSpan,
  UnaryNode,
  UnaryOperator,
} from './expressions/ExpressionNode.js';
export {
  compareValues,
  isEmptyValue,
  isTruthy,
  toArray,
  toNumber,
  valuesAreEqual,
} from './expressions/expressionValues.js';
export { FunctionRegistry } from './expressions/FunctionRegistry.js';
export { parseExpression } from './expressions/parseExpression.js';
export type { ParseExpressionResult } from './expressions/parseExpression.js';
export { printExpression } from './expressions/printExpression.js';
export { tokenize } from './expressions/tokenize.js';
export type { TokenizeResult } from './expressions/tokenize.js';
export type { Token, TokenKind } from './expressions/Token.js';

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
