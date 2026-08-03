/** Built-in kinds are documented; custom validators may add their registered type. */
export const BUILT_IN_SURVEY_ERROR_KINDS = [
  { kind: 'required', description: 'A required question has no answer.' },
  { kind: 'minLength', description: 'A comment answer is shorter than its minimum.' },
  { kind: 'maxLength', description: 'A text or comment answer exceeds its maximum.' },
  { kind: 'min', description: 'A numeric or date answer is below its lower bound.' },
  { kind: 'max', description: 'A numeric or date answer is above its upper bound.' },
  { kind: 'numericvalidator', description: 'The built-in numeric validator failed.' },
  { kind: 'textvalidator', description: 'The built-in text validator failed.' },
  { kind: 'regexvalidator', description: 'The built-in regular-expression validator failed.' },
  { kind: 'emailvalidator', description: 'The built-in email validator failed.' },
  { kind: 'expressionvalidator', description: 'The built-in expression validator failed.' },
  { kind: 'answercountvalidator', description: 'The built-in answer-count validator failed.' },
  { kind: 'eachrowunique', description: 'A matrix row repeats another row\'s answer.' },
  { kind: 'filetoolarge', description: 'An attached file exceeds the authored size limit.' },
  { kind: 'filewrongtype', description: 'An attached file does not match the accepted types.' },
  { kind: 'filetoomany', description: 'A file answer exceeds the authored file-count limit.' },
  { kind: 'host', description: 'A synchronous host validation listener rejected the answer.' },
  { kind: 'server', description: 'An asynchronous server validation result rejected the answer.' },
] as const;

export type BuiltInSurveyErrorKind = (typeof BUILT_IN_SURVEY_ERROR_KINDS)[number]['kind'];
