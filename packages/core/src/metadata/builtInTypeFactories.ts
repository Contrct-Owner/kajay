import { CalculatedValue } from '../model/CalculatedValue.js';
import { HtmlCondition } from '../model/HtmlCondition.js';
import { Page } from '../model/Page.js';
import { Panel } from '../model/Panel.js';
import { Survey } from '../model/Survey.js';
import { Trigger } from '../model/Trigger.js';
import { AnswerCountValidator } from '../model/AnswerCountValidator.js';
import { EmailValidator } from '../model/EmailValidator.js';
import { ExpressionValidator } from '../model/ExpressionValidator.js';
import { NumericValidator } from '../model/NumericValidator.js';
import { RegexValidator } from '../model/RegexValidator.js';
import { TextValidator } from '../model/TextValidator.js';
import { BooleanQuestion } from '../model/BooleanQuestion.js';
import { CommentQuestion } from '../model/CommentQuestion.js';
import { ExpressionQuestion } from '../model/ExpressionQuestion.js';
import { FillInTheBlankItem } from '../model/FillInTheBlankItem.js';
import { FillInTheBlankQuestion } from '../model/FillInTheBlankQuestion.js';
import { MultipleTextItem } from '../model/MultipleTextItem.js';
import { MultipleTextQuestion } from '../model/MultipleTextQuestion.js';
import { RatingQuestion } from '../model/RatingQuestion.js';
import { TextQuestion } from '../model/TextQuestion.js';
import { CheckboxQuestion } from '../model/CheckboxQuestion.js';
import { DropdownQuestion } from '../model/DropdownQuestion.js';
import { ImagePickerQuestion } from '../model/ImagePickerQuestion.js';
import { ItemValue } from '../model/ItemValue.js';
import { RadiogroupQuestion } from '../model/RadiogroupQuestion.js';
import { RankingQuestion } from '../model/RankingQuestion.js';
import { TagboxQuestion } from '../model/TagboxQuestion.js';
import { MatrixCellsQuestion } from '../model/MatrixCellsQuestion.js';
import { MatrixDynamicQuestion } from '../model/MatrixDynamicQuestion.js';
import { MatrixQuestion } from '../model/MatrixQuestion.js';
import { MatrixTotal } from '../model/MatrixTotal.js';
import { PanelDynamicQuestion } from '../model/PanelDynamicQuestion.js';
import { FileQuestion } from '../model/FileQuestion.js';
import { SignatureQuestion } from '../model/SignatureQuestion.js';
import { HtmlElement } from '../model/HtmlElement.js';
import { ImageElement } from '../model/ImageElement.js';
import type { SurveyElement } from '../model/SurveyElement.js';

type BuiltInTypeFactory = () => SurveyElement;

/** Model factories keyed by registered name; metadata definitions remain model-free. */
export const BUILT_IN_TYPE_FACTORIES: Readonly<Record<string, BuiltInTypeFactory>> = {
  survey: () => new Survey(),
  calculatedvalue: () => new CalculatedValue(),
  htmlcondition: () => new HtmlCondition(),
  page: () => new Page(),
  panel: () => new Panel(),
  setvalue: () => new Trigger('setvalue'),
  copyvalue: () => new Trigger('copyvalue'),
  runexpression: () => new Trigger('runexpression'),
  complete: () => new Trigger('complete'),
  skip: () => new Trigger('skip'),
  numericvalidator: () => new NumericValidator(),
  textvalidator: () => new TextValidator(),
  regexvalidator: () => new RegexValidator(),
  emailvalidator: () => new EmailValidator(),
  expressionvalidator: () => new ExpressionValidator(),
  answercountvalidator: () => new AnswerCountValidator(),
  text: () => new TextQuestion(),
  comment: () => new CommentQuestion(),
  boolean: () => new BooleanQuestion(),
  rating: () => new RatingQuestion(),
  expression: () => new ExpressionQuestion(),
  fillintheblankitem: () => new FillInTheBlankItem(),
  fillintheblank: () => new FillInTheBlankQuestion(),
  multipletextitem: () => new MultipleTextItem(),
  multipletext: () => new MultipleTextQuestion(),
  itemvalue: () => new ItemValue(),
  radiogroup: () => new RadiogroupQuestion(),
  dropdown: () => new DropdownQuestion(),
  checkbox: () => new CheckboxQuestion(),
  tagbox: () => new TagboxQuestion(),
  imagepicker: () => new ImagePickerQuestion(),
  ranking: () => new RankingQuestion(),
  matrix: () => new MatrixQuestion(),
  matrixtotal: () => new MatrixTotal(),
  matrixcells: () => new MatrixCellsQuestion(),
  matrixdynamic: () => new MatrixDynamicQuestion(),
  paneldynamic: () => new PanelDynamicQuestion(),
  file: () => new FileQuestion(),
  signaturepad: () => new SignatureQuestion(),
  html: () => new HtmlElement(),
  image: () => new ImageElement(),
};
