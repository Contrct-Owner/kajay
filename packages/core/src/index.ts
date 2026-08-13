// The entire public surface of @kajay/core. Anything not re-exported here is private,
// and there are no subpath entries (ADR-0010) — this file *is* the package.

export { RUNTIME_DIAGNOSTIC_CONTRACT_VERSION } from './contract/generateDiagnosticContract.js';
export type { RuntimeDiagnosticContract } from './contract/generateDiagnosticContract.js';
export { RUNTIME_METADATA_CONTRACT_VERSION } from './contract/generateMetadataContract.js';
export type {
  RuntimeMetadataChildCollection,
  RuntimeMetadataClass,
  RuntimeMetadataContract,
  RuntimeMetadataProperty,
} from './contract/generateMetadataContract.js';
export { EventEmitter } from './events/EventEmitter.js';

// --- Expression language (ADR-0003) ---------------------------------------
export { createDefaultFunctionRegistry } from './expressions/builtInFunctions.js';
export { ExpressionCache } from './expressions/ExpressionCache.js';
// The language's own truthiness. Public because §L3 evaluates a property condition in the
// Creator, and re-deriving "an empty collection is falsy" there would be a second set of
// rules to drift from these.
export { isTruthy } from './expressions/expressionValues.js';
export { createValueResolver, evaluateExpression } from './expressions/evaluateExpression.js';
export type {
  AsyncFunctionValues,
  EvaluationContext,
  EvaluationResult,
} from './expressions/evaluateExpression.js';
export type { ExpressionError } from './expressions/ExpressionError.js';
export type { ExpressionErrorCode } from './expressions/ExpressionErrorCode.js';
export type {
  AsyncExpressionFunction,
  ExpressionFunction,
  ExpressionFunctionContext,
} from './expressions/ExpressionFunction.js';
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
export type { FunctionRegistry } from './expressions/FunctionRegistry.js';
export { parseExpression } from './expressions/parseExpression.js';
export type { ParseExpressionResult } from './expressions/parseExpression.js';
export { printExpression } from './expressions/printExpression.js';

export type { EventListener } from './events/EventEmitter.js';
export type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  ElementStateKind,
  FilesChangedEvent,
  LocaleChangedEvent,
  RecordsChangedEvent,
  SurveyStateChangedEvent,
  ValidateQuestionEvent,
  ValidatingChangedEvent,
  ValueChangedEvent,
} from './events/SurveyEvents.js';

// --- Survey model ----------------------------------------------------------
export type { LogicDiagnostics } from './logic/LogicEngine.js';
export type {
  ChildCollectionDescriptor,
  ClassDefinition,
  ClassDescriptor,
  ClassMetadataDefinition,
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
export type { CalculatedValue } from './model/CalculatedValue.js';
export type { ChoiceFetcher } from './model/ChoiceFetcher.js';
export type {
  ChoicePage,
  ChoicePageItem,
  ChoicePageLoader,
  ChoicePageRequest,
} from './model/ChoicePageLoader.js';
export { BooleanQuestion } from './model/BooleanQuestion.js';
export type { BooleanRenderMode } from './model/BooleanQuestion.js';
export { CheckboxQuestion } from './model/CheckboxQuestion.js';
export { CommentQuestion } from './model/CommentQuestion.js';
export type { DisplayElement } from './model/DisplayElement.js';
export { ExpressionQuestion } from './model/ExpressionQuestion.js';
export type { DisplayStyle } from './model/ExpressionQuestion.js';
export { HtmlElement } from './model/HtmlElement.js';
export { ImageElement } from './model/ImageElement.js';
export { ImagePickerQuestion } from './model/ImagePickerQuestion.js';
export type { MultipleTextItem } from './model/MultipleTextItem.js';
export { MultipleTextQuestion } from './model/MultipleTextQuestion.js';
export type { ContentMode, ImageFit } from './model/ImageElement.js';
export { RatingQuestion } from './model/RatingQuestion.js';
export type { RateType, RatingDisplayMode } from './model/RatingQuestion.js';
export type { DropdownQuestion } from './model/DropdownQuestion.js';
export { MultiSelectQuestion } from './model/MultiSelectQuestion.js';
export type { SingleSelectQuestion } from './model/SingleSelectQuestion.js';
export type { TagboxQuestion } from './model/TagboxQuestion.js';
export type { ItemValue } from './model/ItemValue.js';
// --- Matrix family (§F) ----------------------------------------------------
export { MatrixQuestion, matrixRowKey } from './model/MatrixQuestion.js';
export { MatrixCellsBase } from './model/MatrixCellsBase.js';
export { RepeatingQuestion } from './model/RepeatingQuestion.js';
// --- Dynamic panels (§G) ---------------------------------------------------
export { PanelDynamicQuestion } from './model/PanelDynamicQuestion.js';
// --- Media and upload (§H) -------------------------------------------------
export { FileQuestion } from './model/FileQuestion.js';
export type { FilesChangedListener, FileSeams } from './model/FileQuestion.js';
export type {
  FileCleaner,
  FileDownloader,
  FileEntry,
  FileUploadRequest,
  FileUploader,
} from './model/FileEntry.js';
export { SignatureQuestion } from './model/SignatureQuestion.js';
export type { SignatureFormat } from './model/SignatureQuestion.js';
export type { PanelRenderMode } from './model/PanelDynamicQuestion.js';
export type { MatrixCellsQuestion } from './model/MatrixCellsQuestion.js';
export { MatrixDynamicQuestion } from './model/MatrixDynamicQuestion.js';
export type { MatrixTotal } from './model/MatrixTotal.js';
export type { CellAttachment, MatrixLayout, TotalKind } from './model/matrixCells.js';
export type { ExpressionScope } from './model/SurveyLogicHost.js';
export { RadiogroupQuestion } from './model/RadiogroupQuestion.js';
export { RankingQuestion } from './model/RankingQuestion.js';
export type { RankAreasLayout } from './model/RankingQuestion.js';
export { moveWithin } from './model/moveWithin.js';
export { SelectQuestion } from './model/SelectQuestion.js';
export type { Page } from './model/Page.js';
export { PageElement } from './model/PageElement.js';
export { Panel } from './model/Panel.js';
export type { PanelState } from './model/Panel.js';
export { Question } from './model/Question.js';
export type { ConditionalItemGroup } from './model/Question.js';
export type { Survey } from './model/Survey.js';
export type { HtmlCondition } from './model/HtmlCondition.js';
export type { Endpoints } from './model/endpoints.js';
export type { HostValues } from './model/hostValues.js';
export { measureProgress } from './model/progressBar.js';
export type {
  ProgressBarLocation,
  ProgressBarType,
  ProgressCount,
} from './model/progressBar.js';
export type { TextDirection, TextDirectionSetting } from './model/textDirection.js';
export type { StringDictionary } from './strings/StringDictionary.js';
export type { UiStringKey, UiStrings } from './strings/uiStrings.js';
export { isLocalizedText, resolveLocalizedText } from './model/localizedText.js';
export type { LocaleScope, LocalizedText } from './model/localizedText.js';
export type {
  SurveyTimer,
  TimerPanelLocation,
  TimerPanelMode,
  TimerReading,
} from './model/SurveyTimer.js';
export { scoreQuiz } from './model/quizScore.js';
export type { QuestionScore, QuizScore } from './model/quizScore.js';
export type { AnswerScore } from './model/answerScore.js';
export type { PreviewMode } from './model/previewQuestions.js';
export type { SurveyProgress } from './model/SurveyProgress.js';
export type {
  DurableSurveyState,
  SurveySnapshot,
  SurveyTimerAnchors,
} from './model/SurveySnapshot.js';
export {
  parseSurveySnapshot,
  UnsupportedSurveySnapshotVersionError,
} from './model/SurveySnapshot.js';
export type {
  SurveySnapshotScalar,
  SurveySnapshotValue,
} from './model/SurveySnapshotValue.js';
export type { ClearInvisibleValues } from './model/clearInvisibleAnswers.js';
export type { SurveyState } from './model/SurveyState.js';
export type { SurveyOptions } from './model/SurveyOptions.js';
export { SurveyElement } from './model/SurveyElement.js';
export type { SurveyError } from './model/SurveyError.js';
export type { BuiltInSurveyErrorKind } from './model/SurveyErrorKind.js';
export type {
  AdvanceOutcome,
  CheckErrorsMode,
  QuestionErrorLocation,
  ValidationGate,
} from './model/SurveyValidation.js';
// --- Validation (§D) -------------------------------------------------------
export { AsyncValidator } from './model/AsyncValidator.js';
export type {
  ServerValidationError,
  ServerValidationRequest,
  ServerValidator,
} from './model/ServerValidator.js';
export { Validator } from './model/Validator.js';
export type { ExpressionOutcome, ValidationContext } from './model/Validator.js';
export type { AnswerCountValidator } from './model/AnswerCountValidator.js';
export type { EmailValidator } from './model/EmailValidator.js';
export type { ExpressionValidator } from './model/ExpressionValidator.js';
export type { NumericValidator } from './model/NumericValidator.js';
export type { RegexValidator } from './model/RegexValidator.js';
export type { TextValidator } from './model/TextValidator.js';
export { TextQuestion } from './model/TextQuestion.js';
export type { Trigger } from './model/Trigger.js';
export type { TriggerKind } from './model/Trigger.js';
export type { Diagnostic, DiagnosticSeverity } from './serialization/Diagnostic.js';
export type { DefinitionDiagnosticCode } from './serialization/DiagnosticCode.js';
export { parseSurvey } from './serialization/parseSurvey.js';
export type { ParseOptions, ParseResult } from './serialization/parseSurvey.js';
export {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_ID,
  UnsupportedSchemaVersionError,
} from './serialization/schemaVersion.js';
export { serializeSurvey } from './serialization/serializeSurvey.js';
export type { SurveyDefinition } from './serialization/serializeSurvey.js';
export { digestCanonicalDefinition } from './serialization/definitionDigest.js';
