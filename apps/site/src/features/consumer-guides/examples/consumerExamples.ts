export const RESPONSE_EVENTS = `const parsed = parseSurvey(definition);
const survey = parsed.survey;

const stopValue = survey.onValueChanged.add(({ name, value }) => {
  queueAutosave({ changed: name, value, data: survey.data });
});

const stopComplete = survey.onComplete.add(async ({ data }) => {
  await fetch('/api/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
});

// When the host component unmounts:
stopValue();
stopComplete();`;

export const SAVE_PROGRESS = `import type { SurveyProgress } from '@kajay/core';

function persist(progress: SurveyProgress): void {
  sessionStorage.setItem('survey-progress', JSON.stringify(progress));
}

const stopValue = survey.onValueChanged.add(() => persist(survey.progress));
const stopPage = survey.onCurrentPageChanged.add(() => persist(survey.progress));
const stopComplete = survey.onComplete.add(() => {
  sessionStorage.removeItem('survey-progress');
});

const saved = readAndValidateProgress();
if (saved !== undefined) survey.restore(saved);`;

export const REMOTE_CHOICES = `import type { ChoiceFetcher, ChoicePageLoader } from '@kajay/core';

const fetchJson: ChoiceFetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Choice request failed');
  return response.json();
};

const loadChoicePage: ChoicePageLoader = async ({ skip, take, filter }) => {
  const query = new URLSearchParams({
    skip: String(skip), take: String(take), filter,
  });
  const response = await fetch('/api/cities?' + query);
  return response.json();
};

const { survey } = parseSurvey(definition, { fetchJson, loadChoicePage });`;

export const SERVER_VALIDATION = `import type { ServerValidator } from '@kajay/core';

const validateOnServer: ServerValidator = async ({ data, questionNames }) => {
  const response = await fetch('/api/validate-survey', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data, questionNames }),
  });
  if (!response.ok) throw new Error('Validation service unavailable');
  return response.json();
};

survey.validation.setServerValidator(validateOnServer);`;

export const FILE_SEAMS = `import type { FileCleaner, FileUploader } from '@kajay/core';

const uploadFiles: FileUploader = async ({ questionName, files }) => {
  const response = await uploadToObjectStorage(questionName, files);
  return response.map((stored) => ({
    name: stored.name,
    type: stored.type,
    size: stored.size,
    url: stored.url,
  }));
};

const clearFiles: FileCleaner = async ({ files }) => {
  await Promise.all(files.map((file) => deleteStoredFile(file.url)));
};

const { survey } = parseSurvey(definition, { uploadFiles, clearFiles });`;

export const SURVEY_COMPONENTS = `import type { SurveyComponents } from '@kajay/react';

const components = {
  Button: AppButton,
  Input: AppInput,
  Textarea: AppTextarea,
  Checkbox: AppCheckbox,
  Radio: AppRadio,
} satisfies SurveyComponents;

<Survey model={survey} components={components} />`;

export const CUSTOM_QUESTION = `import { MetadataRegistry, Question, registerBuiltInTypes } from '@kajay/core';
import {
  defaultPageElementRenderers,
  QuestionErrors,
  QuestionTitleContent,
  questionErrorId,
  questionId,
  useIdScope,
  useQuestionValue,
} from '@kajay/react';

class MoodQuestion extends Question {
  override get type(): string { return 'mood'; }
}

const registry = new MetadataRegistry();
registerBuiltInTypes(registry);
registry.addClass({
  name: 'mood',
  parent: 'question',
  create: () => new MoodQuestion(),
  properties: [{ name: 'scale', type: 'number', defaultValue: 5 }],
});

const renderers = defaultPageElementRenderers.clone();
renderers.registerQuestion('mood', function MoodRenderer({ survey, question }) {
  const scope = useIdScope();
  const value = useQuestionValue(survey, question);
  const id = questionId(question, scope);
  const errors = questionErrorId(question, scope);
  return (
    <section>
      <label htmlFor={id}><QuestionTitleContent question={question} /></label>
      <QuestionErrors survey={survey} question={question} at="top" id={errors} />
      <input
        id={id}
        type="range"
        value={Number(value ?? 0)}
        aria-describedby={question.hasErrors ? errors : undefined}
        onChange={(event) => { question.value = Number(event.target.value); }}
      />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errors} />
    </section>
  );
});

const { survey } = parseSurvey(definition, { registry });
<Survey model={survey} renderers={renderers} />`;

export const CUSTOM_PROPERTY = `import {
  MetadataRegistry,
  parseSurvey,
  registerBuiltInTypes,
} from '@kajay/core';
import { CreatorWorkspace } from '@kajay/creator-core';

const registry = new MetadataRegistry();
registerBuiltInTypes(registry);

registry.addProperty('question', {
  name: 'helpUrl',
  type: 'string',
  description: 'A link to guidance for this question.',
});

// Use this same registry everywhere the definition travels.
const { survey } = parseSurvey(definition, { registry });
const workspace = new CreatorWorkspace({ definition, registry });`;

export const CUSTOM_LOGIC = `import {
  AsyncValidator,
  createDefaultFunctionRegistry,
  globalRegistry,
} from '@kajay/core';

const functions = createDefaultFunctionRegistry();
functions.registerAsync('isserved', async (args) => {
  const postcode = String(args[0] ?? '');
  return checkDeliveryArea(postcode);
});

class ReservedNameValidator extends AsyncValidator {
  override get type(): string { return 'reservednamevalidator'; }
  override async validateAsync({ value }) {
    return (await isReserved(String(value)))
      ? { kind: this.type, text: 'That name is reserved.' }
      : undefined;
  }
}

globalRegistry.addClass({
  name: 'reservednamevalidator',
  parent: 'validator',
  create: () => new ReservedNameValidator(),
});

const { survey } = parseSurvey(definition, { functions });`;

export const LOCALIZATION = `const definition: SurveyDefinition = {
  locale: 'en',
  textDirection: 'auto',
  pages: [{
    name: 'contact',
    elements: [{
      type: 'text',
      name: 'name',
      title: { default: 'Your name', fr: 'Votre nom', ar: 'اسمك' },
    }],
  }],
};

survey.strings.register('cy', {
  nextPage: 'Nesaf',
  prevPage: 'Blaenorol',
  complete: 'Gorffen',
});

survey.setLocale('ar'); // React updates and the survey root becomes dir="rtl".`;

export const TROUBLESHOOTING = `const { survey, diagnostics } = parseSurvey(definition, options);

for (const diagnostic of diagnostics) {
  logger.warn(diagnostic.code, diagnostic.path, diagnostic.message);
}

survey.onValueChanged.add(({ name, value }) => {
  logger.debug('answer changed', { name, value });
});

survey.onValidatingChanged.add(({ isValidating }) => {
  logger.debug('validation state', { isValidating });
});`;
